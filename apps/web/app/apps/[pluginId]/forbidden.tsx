/**
 * Custom 403 Forbidden page for plugin access denial
 *
 * Displayed when a user lacks the required role to access a plugin.
 * Uses forbidden() from next/navigation to trigger this page.
 */

export default function Forbidden(): React.ReactElement {
  return (
    <div className="container mx-auto py-8">
      <div className="rounded-lg border bg-destructive/10 p-6">
        <h1 className="text-2xl font-semibold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">
          You don&apos;t have permission to access this plugin.
          Contact your administrator if you believe this is an error.
        </p>
      </div>
    </div>
  )
}
