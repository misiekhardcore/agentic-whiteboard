/** Where stored media lives, and the credential the app writes it with. */
export type MediaConfig = {
  /** The origin the storage API answers on, which need not be the stack's. */
  storageUrl: string;
  /** The service-role key: storage writes are server-side only. */
  serviceRoleKey: string;
  /** The bucket every media object is written into. */
  bucket: string;
};

export type MediaEnvironment = Partial<
  Pick<
    typeof process.env,
    "MEDIA_STORAGE_URL" | "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "MEDIA_BUCKET"
  >
>;
