import {
  ARCHITECT_SOFTWARES,
  PROJECT_STATUSES,
  REVIT_VERSIONS,
} from "@/lib/constants";
import { Button, Input, Label, Select } from "@/components/ui";

type Member = { id: string; name: string | null; email: string | null };

type ProjectValues = {
  jobNumber?: string;
  jobName?: string;
  status?: string;
  leadTechnicianId?: string | null;
  leadEngineer?: string;
  client?: string;
  architect?: string;
  architectSoftware?: string;
  revitVersion?: string;
  startDate?: string;
  nextIssueDate?: string;
};

export function ProjectForm({
  action,
  members,
  values,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  members: Member[];
  values?: ProjectValues;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div>
        <Label>Job number</Label>
        <Input
          name="jobNumber"
          required
          placeholder="e.g. WYE-2026-001"
          defaultValue={values?.jobNumber || ""}
        />
      </div>
      <div>
        <Label>Job name</Label>
        <Input
          name="jobName"
          required
          placeholder="e.g. 30 Cannon Street"
          defaultValue={values?.jobName || ""}
        />
      </div>
      <div>
        <Label>Status</Label>
        <Select name="status" defaultValue={values?.status || "Active"}>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Lead technician</Label>
        <Select
          name="leadTechnicianId"
          defaultValue={values?.leadTechnicianId || ""}
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.email}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Lead engineer</Label>
        <Input name="leadEngineer" defaultValue={values?.leadEngineer || ""} />
      </div>
      <div>
        <Label>Client</Label>
        <Input name="client" defaultValue={values?.client || ""} />
      </div>
      <div>
        <Label>Architect</Label>
        <Input name="architect" defaultValue={values?.architect || ""} />
      </div>
      <div>
        <Label>Architect software</Label>
        <Select
          name="architectSoftware"
          defaultValue={values?.architectSoftware || ARCHITECT_SOFTWARES[0]}
        >
          {ARCHITECT_SOFTWARES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Revit version (WYE)</Label>
        <Select
          name="revitVersion"
          defaultValue={values?.revitVersion || REVIT_VERSIONS[4]}
        >
          {REVIT_VERSIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Start date</Label>
        <Input
          name="startDate"
          placeholder="DD/MM/YYYY"
          defaultValue={values?.startDate || ""}
        />
      </div>
      <div>
        <Label>Next issue date</Label>
        <Input
          name="nextIssueDate"
          placeholder="DD/MM/YYYY"
          defaultValue={values?.nextIssueDate || ""}
        />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
