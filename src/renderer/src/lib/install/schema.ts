import { getTranslate } from '@/lib/i18n'

import { z } from 'zod'

const { t } = getTranslate('desktop')

export const formSchema = z.object({
  title: z.string().min(1, { error: () => t('install.validation.title', 'Title is required') }),
  description: z.string().optional(),
  doomVersionId: z
    .string()
    .min(1, { error: () => t('install.validation.baseGame', 'Base game is required') }),
  sourcePortId: z
    .string()
    .min(1, { error: () => t('install.validation.sourcePort', 'Source port is required') }),
  saveDirectory: z.string().optional(),
  screenshotPath: z.string().optional(),
  launchParameters: z.string().optional(),
  isolatedConfig: z.boolean().optional()
})
