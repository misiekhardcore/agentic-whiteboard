/**
 * The endpoint a turn ran against, as the prompt row records it. A provider id
 * would be a vendor name the deployment may not use; the host is what was
 * actually called and still tells two deployments apart.
 */
export function endpointHost(baseURL: string): string {
  try {
    return new URL(baseURL).host;
  } catch {
    return baseURL;
  }
}
