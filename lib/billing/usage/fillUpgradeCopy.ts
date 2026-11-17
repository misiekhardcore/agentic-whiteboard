/** Fills `{used}`, `{limit}`, `{plan}`, `{period}` and `{account}` tokens. */
export function fillUpgradeCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
