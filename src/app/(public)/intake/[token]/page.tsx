import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { LAND_USE_LABEL } from "@/lib/intake";
import { getSettings } from "@/lib/settings";
import { WI_COUNTY_NAMES } from "@/lib/wi-counties";
import { submitIntakeAction } from "../../../actions";

export const dynamic = "force-dynamic";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200 pt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="mb-3 text-sm text-slate-500">{hint}</p>}
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Text({ name, label, hint, required, type = "text", wide, defaultValue }: { name: string; label: string; hint?: string; required?: boolean; type?: string; wide?: boolean; defaultValue?: string | number | null }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label className="label" htmlFor={name}>{label}{required && " *"}</label>
      {type === "textarea" ? (
        <textarea className="input" id={name} name={name} rows={3} defaultValue={defaultValue ?? undefined} />
      ) : (
        <input className="input" id={name} name={name} type={type} step="any" required={required} defaultValue={defaultValue ?? undefined} />
      )}
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function YesNo({ name, label, hint }: { name: string; label: string; hint?: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-4 text-sm">
        {["yes", "no", "unknown"].map((v) => (
          <label key={v} className="flex items-center gap-1">
            <input type="radio" name={name} value={v} defaultChecked={v === "unknown"} /> {v === "unknown" ? "not sure" : v}
          </label>
        ))}
      </div>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default async function IntakePage({ params, searchParams }: { params: { token: string }; searchParams: { done?: string } }) {
  const project = await db.project.findUnique({
    where: { intakeToken: params.token },
    include: { deal: { include: { company: true, site: true } } },
  });
  if (!project) notFound();
  const s = await getSettings();
  const site = project.deal.site;

  if (searchParams.done || project.intakeSubmittedAt) redirect(`/c/${params.token}`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="card p-8">
        <div className="text-xs uppercase tracking-widest text-indigo-700">{s.companyName}</div>
        <h1 className="mt-1 text-2xl font-bold">Site questionnaire — {project.deal.company.name}</h1>
        <p className="mt-2 text-sm text-slate-600">
          About 15 minutes. &quot;Not sure&quot; is a fine answer — we&apos;ll fill gaps on a call. Everything here goes straight into your permit drafts, so you won&apos;t be asked twice.
        </p>

        <form action={submitIntakeAction.bind(null, params.token)} className="mt-6 space-y-8">
          <Section title="The site">
            <Text name="siteName" label="Site name" required defaultValue={site?.name} />
            <div>
              <label className="label" htmlFor="county">County *</label>
              <select className="input" id="county" name="county" required defaultValue={site?.county ?? ""}>
                <option value="" disabled>Choose…</option>
                {WI_COUNTY_NAMES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <Text name="town" label="Town / village / city" defaultValue={site?.municipality} />
            <Text name="siteAddress" label="Address or fire number" />
            <Text name="parcelIds" label="Tax parcel numbers" hint="From the tax bill; comma-separated." />
            <Text name="legalDescription" label="Legal description" hint="e.g. NE¼ of the SW¼, Sec. 12, T7N, R9E" />
            <Text name="landownerName" label="Landowner (if not you)" />
            <Text name="landownerAddress" label="Landowner address" />
            <Text name="leaseExpires" label="Lease expiration (if leased)" type="date" />
          </Section>

          <Section title="The project">
            <div className="md:col-span-2">
              <span className="label">What are we permitting? *</span>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                {[
                  ["new", "A new pit or quarry"],
                  ["expansion", "Expanding an existing site"],
                  ["existing", "Bringing an existing site's permits up to date"],
                  ["transfer", "Taking over a site from another operator"],
                ].map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2">
                    <input type="radio" name="projectType" value={v} required defaultChecked={v === (site?.isNewSite ? "new" : "existing")} /> {l}
                  </label>
                ))}
              </div>
            </div>
            <Text name="targetStart" label="When do you want to be operating?" type="date" />
          </Section>

          <Section title="Footprint" hint="Rough numbers are fine.">
            <Text name="totalAcres" label="Total site acres" type="number" />
            <Text name="disturbedAcres" label="Acres disturbed (or to be disturbed)" type="number" />
            <Text name="maxDepthFt" label="Maximum mining depth (ft)" type="number" />
            <Text name="depthToGroundwaterFt" label="Depth to groundwater (ft)" type="number" />
            <YesNo name="belowWaterTable" label="Will you mine below the water table?" />
            <Text name="topsoilInches" label="Typical topsoil depth (inches)" type="number" />
            <div>
              <label className="label" htmlFor="postMiningLandUse">After mining, the land becomes…</label>
              <select className="input" id="postMiningLandUse" name="postMiningLandUse" defaultValue="undecided">
                {Object.entries(LAND_USE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </Section>

          <Section title="Water">
            <YesNo name="dewatering" label="Do you pump water out of the pit?" />
            <Text name="dewateringGpm" label="Pump capacity (gallons per minute)" type="number" />
            <YesNo name="washing" label="Wash plant on site?" />
            <Text name="wellsOnProperty" label="Wells on the property" hint='List each with capacity, e.g. "wash well 450 gpm, shop well 10 gpm".' />
            <YesNo name="wetlandsOrStreams" label="Wetlands, streams or ponds on or next to the site?" />
            <Text name="nearestWaterbody" label="Nearest stream / lake / ditch" />
          </Section>

          <Section title="Equipment">
            <YesNo name="crushing" label="Crushing or screening on site?" />
            <YesNo name="portablePlant" label="Is the crusher portable (moves between sites)?" />
            <Text name="equipmentList" label="Crushers / screens / conveyors" type="textarea" wide hint="Make, model, year and rated tons per hour if you have them." />
            <Text name="maxThroughputTph" label="Max throughput (tons per hour)" type="number" />
            <YesNo name="hotMixOrReadyMix" label="Asphalt or ready-mix plant on site?" />
            <YesNo name="blasting" label="Blasting?" />
            <Text name="fuelStorageGallons" label="Fuel & oil stored on site (total gallons)" type="number" hint="Tanks and drums 55 gal or larger." />
          </Section>

          <Section title="Operations & neighbors">
            <Text name="hoursOfOperation" label="Hours of operation" hint="e.g. Mon–Fri 6am–6pm, Sat 7am–noon" />
            <Text name="seasonMonths" label="Operating season" hint="e.g. April–November" />
            <Text name="truckTripsPerDay" label="Truck loads per day (busy day)" type="number" />
            <Text name="haulRoute" label="Haul route to the main road" />
            <Text name="nearestResidenceFt" label="Distance to nearest home (ft)" type="number" />
          </Section>

          <Section title="History">
            <Text name="existingPermits" label="Permits you already hold" type="textarea" wide hint="Reclamation permit, CUP, WPDES, air — with numbers if handy." />
            <Text name="countyConcerns" label="Anything the county, town or neighbors have raised?" type="textarea" wide />
            <Text name="notes" label="Anything else we should know" type="textarea" wide />
            <Text name="siteContactName" label="On-site contact" />
            <Text name="siteContactPhone" label="On-site contact phone" type="tel" />
          </Section>

          <div className="border-t border-slate-200 pt-6">
            <SubmitButton pendingText="Submitting…">Submit questionnaire</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
