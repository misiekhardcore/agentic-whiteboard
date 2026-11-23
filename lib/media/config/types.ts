/** Where stored media lives, and the credential the app writes it with. */
export type MediaConfig = {
  /** The stack's own origin, the one its storage API answers on. */
  supabaseUrl: string;
  /** The service-role key: storage writes are server-side only. */
  serviceRoleKey: string;
  /** The bucket every media object is written into. */
  bucket: string;
};

export type MediaEnvironment = Partial<
  Pick<typeof process.env, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "MEDIA_BUCKET">
>;
