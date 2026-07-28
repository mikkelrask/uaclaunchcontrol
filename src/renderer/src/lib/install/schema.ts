import { z } from 'zod'

export const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  doomVersionId: z.string().min(1, 'Base game is required'),
  sourcePortId: z.string().min(1, 'Source port is required'),
  saveDirectory: z.string().optional(),
  screenshotPath: z.string().optional(),
  launchParameters: z.string().optional(),
  isolatedConfig: z.boolean().optional()
})
