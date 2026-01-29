/**
 * Encryption Key Rotation Command
 *
 * Re-encrypts all sensitive data with the current primary key.
 * Used when rotating encryption keys to migrate from old key to new key.
 *
 * Usage:
 *   node ace encryption:rotate --dry-run        # Preview what would be migrated
 *   node ace encryption:rotate                  # Migrate all encrypted fields
 *   node ace encryption:rotate --table=tenant_sso_configs  # Migrate specific table
 */

import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import { EncryptionService, encryptionService } from '#services/encryption_service'

interface EncryptedColumn {
  table: string
  column: string
  idColumn: string
  tenantIdColumn: string | null
  aadTemplate: (row: Record<string, unknown>) => string
}

// Registry of encrypted columns in the database
const ENCRYPTED_COLUMNS: EncryptedColumn[] = [
  {
    table: 'tenant_sso_configs',
    column: 'oidc_client_secret',
    idColumn: 'id',
    tenantIdColumn: 'tenant_id',
    aadTemplate: (row) =>
      EncryptionService.buildAAD({
        tenantId: row.tenant_id as number,
        table: 'tenant_sso_configs',
        field: 'oidcClientSecret',
        recordId: row.id as number,
      }),
  },
  {
    table: 'tenant_sso_configs',
    column: 'saml_certificate',
    idColumn: 'id',
    tenantIdColumn: 'tenant_id',
    aadTemplate: (row) =>
      EncryptionService.buildAAD({
        tenantId: row.tenant_id as number,
        table: 'tenant_sso_configs',
        field: 'samlCertificate',
        recordId: row.id as number,
      }),
  },
  {
    table: 'tenant_sso_configs',
    column: 'saml_private_key',
    idColumn: 'id',
    tenantIdColumn: 'tenant_id',
    aadTemplate: (row) =>
      EncryptionService.buildAAD({
        tenantId: row.tenant_id as number,
        table: 'tenant_sso_configs',
        field: 'samlPrivateKey',
        recordId: row.id as number,
      }),
  },
]

export default class EncryptionRotate extends BaseCommand {
  static commandName = 'encryption:rotate'
  static description = 'Re-encrypt all sensitive data with the current primary key'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Preview changes without modifying data' })
  declare dryRun: boolean

  @flags.string({ description: 'Only process specific table' })
  declare table: string

  @flags.number({ description: 'Batch size for processing rows', default: 100 })
  declare batchSize: number

  async run(): Promise<void> {
    this.logger.info('Encryption Key Rotation')
    this.logger.info('='.repeat(50))

    // Show current key info
    this.logger.info(`Primary key ID: ${encryptionService.getPrimaryKeyId()}`)
    this.logger.info(`Available keys: ${encryptionService.getKeyIds().join(', ')}`)
    this.logger.info('')

    // Filter columns if table specified
    const columnsToProcess = this.table
      ? ENCRYPTED_COLUMNS.filter((c) => c.table === this.table)
      : ENCRYPTED_COLUMNS

    if (columnsToProcess.length === 0) {
      this.logger.error(`No encrypted columns found for table: ${this.table}`)
      return
    }

    // Preview mode
    if (this.dryRun) {
      this.logger.info('DRY RUN - No changes will be made')
      this.logger.info('')
    }

    let totalProcessed = 0
    let totalUpdated = 0
    let totalErrors = 0

    for (const columnDef of columnsToProcess) {
      const result = await this.processColumn(columnDef)
      totalProcessed += result.processed
      totalUpdated += result.updated
      totalErrors += result.errors
    }

    this.logger.info('')
    this.logger.info('='.repeat(50))
    this.logger.info('Summary:')
    this.logger.info(`  Total rows processed: ${totalProcessed}`)
    this.logger.info(`  Total rows updated: ${totalUpdated}`)
    this.logger.info(`  Total errors: ${totalErrors}`)

    if (this.dryRun) {
      this.logger.info('')
      this.logger.info('This was a dry run. Run without --dry-run to apply changes.')
    }
  }

  private async processColumn(
    columnDef: EncryptedColumn
  ): Promise<{ processed: number; updated: number; errors: number }> {
    const { table, column, idColumn } = columnDef

    this.logger.info(`Processing ${table}.${column}...`)

    let processed = 0
    let updated = 0
    let errors = 0

    // Get total count
    const countResult = await db.from(table).whereNotNull(column).count('* as total').first()
    const total = Number(countResult?.total || 0)

    if (total === 0) {
      this.logger.info(`  No rows with encrypted data`)
      return { processed: 0, updated: 0, errors: 0 }
    }

    this.logger.info(`  Found ${total} rows with data`)

    // Process in batches
    let offset = 0
    while (offset < total) {
      const rows = await db
        .from(table)
        .whereNotNull(column)
        .orderBy(idColumn)
        .offset(offset)
        .limit(this.batchSize)

      for (const row of rows) {
        processed++
        const value = row[column] as string

        if (!value) continue

        // Check if already encrypted with current key
        if (encryptionService.isEncrypted(value)) {
          const parts = value.split(':')
          const keyId = parts[2]

          if (keyId === encryptionService.getPrimaryKeyId()) {
            // Already encrypted with current key
            continue
          }
        }

        try {
          // Build AAD for this row
          const aad = columnDef.aadTemplate(row)

          // Re-encrypt with new key
          // For existing encrypted data, try to decrypt first
          let plaintext: string
          if (encryptionService.isEncrypted(value)) {
            // Try decrypting (may need old AAD or no AAD for legacy data)
            try {
              plaintext = encryptionService.decrypt(value, aad)
            } catch {
              // Try without AAD (for data encrypted before AAD was added)
              plaintext = encryptionService.decrypt(value)
            }
          } else {
            // Plaintext - encrypt it
            plaintext = value
          }

          const newValue = encryptionService.encrypt(plaintext, aad)

          if (!this.dryRun) {
            await db
              .from(table)
              .where(idColumn, row[idColumn])
              .update({ [column]: newValue })
          }

          updated++
        } catch (error) {
          errors++
          this.logger.error(
            `  Error processing ${table}.${column} id=${row[idColumn]}: ${(error as Error).message}`
          )
        }
      }

      offset += this.batchSize
      this.logger.info(`  Processed ${Math.min(offset, total)}/${total} rows`)
    }

    this.logger.info(`  Updated: ${updated}, Errors: ${errors}`)
    return { processed, updated, errors }
  }
}
