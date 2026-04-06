import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export default function Page() {
  return (
    <div className="flex min-h-svh p-6 items-center justify-center bg-muted/20">
      <div className="flex w-full max-w-3xl flex-col gap-8 text-sm leading-loose">
        <div className="text-center space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">Component Testing</h1>
          <p className="text-muted-foreground">Dropdown, Sheet and Card components from shadcn UI.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Component */}
          <Card>
            <CardHeader>
              <CardTitle>Test Card</CardTitle>
              <CardDescription>This is a testing card component.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Card content goes here. You can test your typography and layout inside this container.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Action</Button>
            </CardFooter>
          </Card>

          <div className="flex flex-col gap-6 items-center justify-center p-6 border rounded-xl bg-background shadow-sm">
            {/* Dropdown Menu Component */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-48">Open Dropdown</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Billing</DropdownMenuItem>
                <DropdownMenuItem>Team</DropdownMenuItem>
                <DropdownMenuItem>Subscription</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sheet Component */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary" className="w-48">Open Sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Are you absolutely sure?</SheetTitle>
                  <SheetDescription>
                    This action cannot be undone. This will permanently delete your account
                    and remove your data from our servers.
                  </SheetDescription>
                </SheetHeader>
                <div className="py-6">
                  <p className="text-sm text-muted-foreground">
                    This is the sheet content area. You can put forms or other details here.
                  </p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="text-muted-foreground font-mono text-xs text-center mt-4">
          (Press <kbd className="border bg-muted px-1.5 py-0.5 rounded-md">d</kbd> to toggle dark mode)
        </div>
      </div>
    </div>
  )
}
