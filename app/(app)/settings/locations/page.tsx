import { listLocations } from "@/lib/actions/locations";
import { LocationsTable } from "./locations-table";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const locations = await listLocations();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Manage the QTL shop locations. Locations cannot be deleted — deactivate instead.
          </p>
        </div>
      </div>
      <LocationsTable locations={locations} />
    </div>
  );
}
