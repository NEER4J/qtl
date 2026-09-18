import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MultiLine, SimpleBar } from "@/components/analytics/charts";
import type { Deck, DeckAnalytics } from "@/lib/actions/analytics";
import { formatMoney } from "@/lib/utils/format";

const DECK_LABEL: Record<Deck, string> = { upper: "Upper deck", lower: "Lower deck" };
const DECKS: Deck[] = ["upper", "lower"];

/**
 * Upper / Lower deck activity: who worked each deck, how many jobs, sales and
 * time, which service types, and who works together. Data from getDeckAnalytics.
 */
export function DecksSection({ data, technician }: { data: DeckAnalytics; technician?: string }) {
  if (!data.supported) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        Deck analytics need <span className="font-mono text-xs">migration 0146</span> applied to
        the database.
      </div>
    );
  }

  // Top 3 service types per deck + technician, for the table.
  const topServices = new Map<string, string>();
  for (const deck of DECKS) {
    for (const t of data.by_tech.filter((x) => x.deck === deck)) {
      const mix = data.service_mix
        .filter((s) => s.deck === deck && s.tech === t.tech)
        .slice(0, 3)
        .map((s) => `${s.service_name} ${s.jobs}`);
      topServices.set(`${deck}|${t.tech}`, mix.join(" · "));
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Upper &amp; Lower deck</h2>
        <p className="text-sm text-muted-foreground">
          Who worked each deck on {data.total_jobs.toLocaleString()} job
          {data.total_jobs === 1 ? "" : "s"}
          {technician ? ` with ${technician}` : ""} — {data.period_label}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DECKS.map((deck) => {
          const c = data.coverage.find((x) => x.deck === deck);
          const assigned = c?.assigned ?? 0;
          const total = assigned + (c?.blank ?? 0);
          const pct = total > 0 ? Math.round((assigned / total) * 100) : 0;
          return (
            <Card key={deck}>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">{DECK_LABEL[deck]}</div>
                <div className="text-2xl font-bold tabular-nums mt-1">
                  {assigned.toLocaleString()} <span className="text-base font-normal text-muted-foreground">of {total.toLocaleString()} jobs</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {pct}% have a tech recorded · {(c?.blank ?? 0).toLocaleString()} left blank
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DECKS.map((deck) => {
          const rows = data.by_tech.filter((t) => t.deck === deck);
          return (
            <Card key={deck}>
              <CardHeader><CardTitle>{DECK_LABEL[deck]} — jobs by technician</CardTitle></CardHeader>
              <CardContent>
                {rows.length > 0 ? (
                  <SimpleBar
                    data={rows.slice(0, 15)}
                    xKey="tech"
                    yKey="jobs"
                    horizontal
                    height={Math.max(160, Math.min(rows.length, 15) * 28)}
                  />
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Deck activity per week</CardTitle></CardHeader>
          <CardContent>
            {data.weekly.length > 0 ? (
              <MultiLine
                data={data.weekly}
                xKey="week"
                keys={["jobs", "upper", "lower"]}
                labels={{ jobs: "All jobs", upper: "Upper tech recorded", lower: "Lower tech recorded" }}
              />
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>By technician and deck</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.by_tech.length === 0 ? (
            <EmptyChart />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead>Deck</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Avg time</TableHead>
                  <TableHead>Top services</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_tech.map((t) => (
                  <TableRow key={`${t.deck}|${t.tech}`}>
                    <TableCell className="font-medium">{t.tech}</TableCell>
                    <TableCell>{DECK_LABEL[t.deck]}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.jobs.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(t.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.avg_minutes == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span title={`${t.timed_jobs} job${t.timed_jobs === 1 ? "" : "s"} with start and end times`}>
                          {Math.round(t.avg_minutes)} min
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {topServices.get(`${t.deck}|${t.tech}`) || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Who works together (Upper + Lower)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.pairs.length === 0 ? (
            <EmptyChart />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Upper tech</TableHead>
                  <TableHead>Lower tech</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pairs.map((p) => (
                  <TableRow key={`${p.upper_tech}|${p.lower_tech}`}>
                    <TableCell>{p.upper_tech}</TableCell>
                    <TableCell>{p.lower_tech}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.jobs.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
      No deck data for the selected filters.
    </div>
  );
}
