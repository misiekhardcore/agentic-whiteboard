/**
 * Reads a text field from a submitted form. `FormData.get` also returns `File`
 * for file inputs, and `String(file)` is "[object File]", so narrow to the text
 * case instead of stringifying whatever came back.
 */
export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
