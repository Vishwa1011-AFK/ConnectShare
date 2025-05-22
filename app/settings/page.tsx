"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import { ArrowRight, Info, Moon, Sun, Laptop, Save, Check } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

// Form validation schema
const formSchema = z.object({
  displayName: z
    .string()
    .min(2, {
      message: "Display name must be at least 2 characters.",
    })
    .max(30, {
      message: "Display name must not exceed 30 characters.",
    }),
  enableAnimations: z.boolean().default(true),
  enableNotifications: z.boolean().default(true),
})

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  // Initialize form with react-hook-form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: "",
      enableAnimations: true,
      enableNotifications: true,
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSaving(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Settings updated",
        description: "Your settings have been updated successfully.",
        variant: "default",
      })

      // Here you would typically save to a database or local storage
      localStorage.setItem("connectshare-settings", JSON.stringify(values))
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  return (
    <div className="container max-w-2xl py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your application preferences</p>
      </motion.div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <motion.div variants={container} initial="hidden" animate="show">
            <motion.div variants={item}>
              <h2 className="text-xl font-semibold mb-4">General</h2>
              <Card className="mb-8">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your display name" {...field} />
                          </FormControl>
                          <FormDescription>This name will be visible to other peers when connecting</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item}>
              <h2 className="text-xl font-semibold mb-4">Appearance</h2>
              <Card className="mb-8">
                <CardContent className="p-0">
                  <div className="p-6 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">Theme</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {theme === "light" && "Light mode"}
                        {theme === "dark" && "Dark mode"}
                        {theme === "system" && `System preference (${resolvedTheme})`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className={`rounded-full ${theme === "light" ? "bg-primary text-primary-foreground" : ""}`}
                        onClick={() => setTheme("light")}
                      >
                        <Sun className="h-5 w-5" />
                        <span className="sr-only">Light mode</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className={`rounded-full ${theme === "dark" ? "bg-primary text-primary-foreground" : ""}`}
                        onClick={() => setTheme("dark")}
                      >
                        <Moon className="h-5 w-5" />
                        <span className="sr-only">Dark mode</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className={`rounded-full ${theme === "system" ? "bg-primary text-primary-foreground" : ""}`}
                        onClick={() => setTheme("system")}
                      >
                        <Laptop className="h-5 w-5" />
                        <span className="sr-only">System preference</span>
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="p-6 flex items-center justify-between">
                    <FormField
                      control={form.control}
                      name="enableAnimations"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg w-full">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Animations</FormLabel>
                            <FormDescription>Enable or disable UI animations</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <div className="p-6 flex items-center justify-between">
                    <FormField
                      control={form.control}
                      name="enableNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg w-full">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Notifications</FormLabel>
                            <FormDescription>Enable or disable system notifications</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item}>
              <h2 className="text-xl font-semibold mb-4">About</h2>
              <Card className="mb-8">
                <CardContent className="p-0">
                  <div className="p-6 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h3 className="font-medium">App Version</h3>
                      <p className="text-sm text-muted-foreground">Version 1.0.0</p>
                    </div>
                    <div className="text-muted-foreground">
                      <Info className="h-5 w-5" />
                    </div>
                  </div>

                  <Separator />

                  <div className="p-6 flex items-center justify-between">
                    <h3 className="font-medium">Terms of Service</h3>
                    <Button variant="ghost" size="icon">
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </div>

                  <Separator />

                  <div className="p-6 flex items-center justify-between">
                    <h3 className="font-medium">Privacy Policy</h3>
                    <Button variant="ghost" size="icon">
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item} className="flex justify-end">
              <Button type="submit" disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                    >
                      <Save className="h-4 w-4" />
                    </motion.div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </motion.div>
          </motion.div>
        </form>
      </Form>
    </div>
  )
}
