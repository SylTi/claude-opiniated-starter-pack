'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@saas/ui/card'
import { Button } from '@saas/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { XCircle } from 'lucide-react'

export default function BillingCancelPage(): React.ReactElement {
  const { t } = useI18n('skeleton')
  const router = useRouter()

  return (
    <div className="container mx-auto py-16 flex items-center justify-center">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <XCircle className="h-16 w-16 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">{t('billingCancel.title')}</CardTitle>
          <CardDescription>
            {t('billingCancel.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {t('billingCancel.helpText')}
          </p>
        </CardContent>
        <CardFooter className="justify-center gap-2">
          <Button variant="outline" onClick={() => router.push('/billing')}>
            {t('billingCancel.viewPlans')}
          </Button>
          <Button onClick={() => router.push('/dashboard')}>
            {t('common.goToDashboard')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
