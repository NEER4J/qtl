// What a package's labour line is called. 52 packages were loaded with the
// text "0" as their labour description (client 2026-11-27: a "• 0" row printed
// under the package on the invoice), so a blank or "0" reads as plain "Labor".
export function packageLaborLabel(description: string | null | undefined): string {
  const d = (description ?? "").trim();
  return d === "" || d === "0" ? "Labor" : d;
}
