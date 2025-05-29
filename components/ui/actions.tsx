import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { motion, HTMLMotionProps } from "framer-motion"
import { ArrowRight } from 'lucide-react'

interface ActionProps {
  name: string
  description: string
  onClick?: () => void
  href?: string
}

interface ActionsProps {
  children: React.ReactNode
}

const Action = React.forwardRef<
  HTMLButtonElement,
  ActionProps & React.ComponentPropsWithoutRef<typeof Button>
>(({ name, description, onClick, href, className, ...props }, ref) => {
  const content = (
    <div className="flex items-center justify-between w-full text-left">
      <div>
        <h4 className="font-medium">{name}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
    </div>
  )

  if (href) {
    return (
      <Button
        ref={ref}
        variant="ghost"
        className={`h-auto p-4 justify-start group hover:bg-muted/50 ${className}`}
        asChild
        {...props}
      >
        <a href={href}>
          {content}
        </a>
      </Button>
    )
  }

  return (
    <Button
      ref={ref}
      variant="ghost"
      className={`h-auto p-4 justify-start group hover:bg-muted/50 ${className}`}
      onClick={onClick}
      {...props}
    >
      {content}
    </Button>
  )
})
Action.displayName = "Action"

const Actions = React.forwardRef<
  HTMLDivElement,
  ActionsProps & Omit<HTMLMotionProps<"div">, "ref">
>(({ children, className, ...props }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className={className}
      {...props}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Suggested Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
})
Actions.displayName = "Actions"

export { Actions, Action }