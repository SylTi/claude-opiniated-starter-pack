'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { authApi } from '@/lib/auth'
import { ApiError } from '@/lib/api'
import { profileSchema, type ProfileFormData } from '@/lib/validations'

export default function ProfilePage(): React.ReactElement {
  const { user, refreshUser } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onBlur',
    defaultValues: {
      fullName: user?.fullName || '',
      avatarUrl: user?.avatarUrl || '',
    },
  })

  const onSubmit = async (data: ProfileFormData): Promise<void> => {
    try {
      setError(null)
      await authApi.updateProfile({
        fullName: data.fullName || undefined,
        avatarUrl: data.avatarUrl || null,
      })
      await refreshUser()
      toast.success('Profile updated successfully')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred')
      }
    }
  }

  if (!user) {
    return <></>
  }

  const initials = user.fullName
    ? user.fullName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase()

  return (
    <div>
      <h1 className="text-2xl font-bold">Profile</h1>
      <p className="text-muted-foreground mt-1">Manage your account information</p>

      <Separator className="my-6" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-md">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Avatar Preview */}
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user.avatarUrl || undefined} alt={user.fullName || user.email} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{user.fullName || 'No name set'}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {!user.emailVerified && (
              <p className="text-sm text-amber-600">Email not verified</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            type="text"
            {...register('fullName')}
            className="mt-1"
          />
          {errors.fullName && (
            <p className="mt-1 text-sm text-destructive">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={user.email}
            disabled
            className="mt-1 bg-muted"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Email cannot be changed
          </p>
        </div>

        <div>
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input
            id="avatarUrl"
            type="url"
            placeholder="https://example.com/avatar.jpg"
            {...register('avatarUrl')}
            className="mt-1"
          />
          {errors.avatarUrl && (
            <p className="mt-1 text-sm text-destructive">{errors.avatarUrl.message}</p>
          )}
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </form>
    </div>
  )
}
