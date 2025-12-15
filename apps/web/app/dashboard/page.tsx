import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your SaaS dashboard. This is an example page using shadcn/ui components.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
            <CardDescription>Active users in your application</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground mt-2">+20% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <CardDescription>Monthly recurring revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$12,345</div>
            <p className="text-xs text-muted-foreground mt-2">+15% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Current active sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">573</div>
            <p className="text-xs text-muted-foreground mt-2">Real-time count</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks you might want to perform</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button>Create User</Button>
            <Button variant="outline">View Reports</Button>
            <Button variant="secondary">Settings</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
