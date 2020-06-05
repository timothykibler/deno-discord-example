import 'https://deno.land/x/dotenv/load.ts'

const env = Deno.env.toObject()

const config = { ...env }

export { config }
