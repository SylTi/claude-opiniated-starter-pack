'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@saas/ui/card'
import { Button } from '@saas/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { CheckCircle } from 'lucide-react'

export default function BillingSuccessPage(): React.ReactElement {
  const { t } = useI18n('skeleton')
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push('/billing')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [router])

  return (
    <div className="container mx-auto py-16 flex items-center justify-center">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">{t('billingSuccess.title')}</CardTitle>
          <CardDescription>
            {t('billingSuccess.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {t('billingSuccess.redirectMessage', { seconds: countdown })}
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Button onClick={() => router.push('/billing')}>
            {t('billingSuccess.goNow')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
