# Interested People — Status Configuration Inventory

> **Purpose**: Comprehensive inventory of how the "Interested People" statuses work today,
> to plan adding customizable status configurations (name, color, icon) per status.
>
> **Generated**: 2026-06-30

---

## 1. InterestedPersonStatus Type

**File**: `web/src/types/data.ts:91`

```ts
export type InterestedPersonStatus = "bible_student" | "return_visit" | "interested_person";
```

Exactly **3 hardcoded string literal values**. No runtime object, metadata, or configuration — just a union type.

### 1.1 InterestedPerson Interface

**File**: `web/src/types/data.ts:93-108`

```ts
export interface InterestedPerson {
  id: string;
  name: string;
  last_name: string;
  gender: "male" | "female";
  age: number | null;
  address: string | null;
  comments: string | null;
  latitude: number | null;
  longitude: number | null;
  initial_conversation_date: string | null;
  next_visit_date: string | null;
  status: InterestedPersonStatus;   // <-- typed to the 3-value union
  created_at: string;
  updated_at: string;
}
```

The `status` field is not nullable, no fallback — always one of the 3 values.

---

## 2. Interested Page — `web/src/app/(dashboard)/interested/page.tsx`

**Full file**: 185 lines. Key structures:

### 2.1 STATUS_COLORS (lines 20-24)

```ts
const STATUS_COLORS: Record<InterestedPersonStatus, string> = {
  bible_student: "#10b981",      // green
  return_visit: "#f59e0b",       // amber
  interested_person: "#2094f3",  // blue
};
```

Hardcoded at the page level. Used to render colored dots in filter tabs and on person cards.

### 2.2 STATUS_LABEL_KEYS (lines 26-30)

```ts
const STATUS_LABEL_KEYS: Record<InterestedPersonStatus, string> = {
  bible_student: "interested.bibleStudent",
  return_visit: "interested.returnVisit",
  interested_person: "interested.interestedPerson",
};
```

Maps status values to i18n translation keys. Used to display the status label on person cards.

### 2.3 StatusFilter Type (line 32)

```ts
type StatusFilter = "all" | InterestedPersonStatus;
```

### 2.4 FILTER_OPTIONS (lines 34-39)

```ts
const FILTER_OPTIONS: { id: StatusFilter; labelKey: string }[] = [
  { id: "all",              labelKey: "interested.all" },
  { id: "bible_student",     labelKey: "interested.bibleStudent" },
  { id: "return_visit",      labelKey: "interested.returnVisit" },
  { id: "interested_person", labelKey: "interested.interestedPerson" },
];
```

Filter tabs rendered as a 4-column grid (`grid grid-cols-4`). Each tab button shows:
- A colored dot (`size-2 rounded-full`, using `STATUS_COLORS[option.id]`) — only for non-"all" options
- The translated label text

Active tab gets `bg-surface text-slate-900 dark:text-white shadow-sm` styling.

### 2.5 Person Card Rendering (lines 112-160)

Each person card shows:
- **Left border**: colored by gender (`GENDER_COLORS[person.gender]` — blue for male, pink for female), 4px wide
- **Status dot**: `size-3 rounded-full` with `STATUS_COLORS[person.status]` as background
- **Gender symbol**: ♂/♀ in the gender color
- **Name**: `person.name person.last_name`
- **Status label**: translated via `STATUS_LABEL_KEYS[person.status]`
- **Location link**: Google Maps link if lat/lng present
- **Next visit date**: `person.next_visit_date` or "Not scheduled"

### 2.6 State Management

- `statusFilter` state: `useState<StatusFilter>("all")`
- `filteredPeople`: derived by filtering `interestedPeople` on `statusFilter`
- Edit/Add modal: `InterestedPersonModal` lazy-loaded with `dynamic(() => import(...))`

---

## 3. InterestedPersonModal — `web/src/components/interested/InterestedPersonModal.tsx`

**Full file**: 461 lines. Duplicates the status configurations:

### 3.1 Duplicated STATUS_COLORS (lines 21-25)

```ts
const STATUS_COLORS: Record<InterestedPersonStatus, string> = {
  bible_student: "#10b981",
  return_visit: "#f59e0b",
  interested_person: "#2094f3",
};
```

**Identical to the page-level definition** — duplicated code.

### 3.2 STATUS_ORDER (lines 27-31)

```ts
const STATUS_ORDER: InterestedPersonStatus[] = [
  "bible_student",
  "return_visit",
  "interested_person",
];
```

Controls the rendering order of status buttons in the modal form.

### 3.3 Duplicated STATUS_LABEL_KEYS (lines 33-37)

```ts
const STATUS_LABEL_KEYS: Record<InterestedPersonStatus, string> = {
  bible_student: "interested.bibleStudent",
  return_visit: "interested.returnVisit",
  interested_person: "interested.interestedPerson",
};
```

Also duplicated from the page.

### 3.4 Status Dropdown Rendering (lines 273-300)

The status is **not a dropdown** — it's rendered as **horizontal pill buttons**:

```
<div className="flex flex-wrap gap-2">
  {STATUS_ORDER.map((s) => (
    <button onClick={() => setStatus(s)} ...>
      <span className="size-2 rounded-full" style={{ backgroundColor: selected ? #fff : STATUS_COLORS[s] }} />
      {t(STATUS_LABEL_KEYS[s])}
    </button>
  ))}
</div>
```

Active button: colored background (`STATUS_COLORS[s]`), white text, white dot.
Inactive button: border outline, gray text, colored dot.

### 3.5 Default Status

```ts
const [status, setStatus] = useState<InterestedPersonStatus>(
  person?.status ?? "interested_person"
);
```

Default for new persons is `"interested_person"`.

### 3.6 Form Data on Submit

The `data` object passed to `addInterestedPerson`/`updateInterestedPerson` includes:
```ts
{
  name, last_name, gender, age, address, comments,
  latitude, longitude, initial_conversation_date, next_visit_date,
  status,  // one of the 3 string literals
}
```

---

## 4. i18n Keys — `web/src/lib/i18n.tsx`

### 4.1 All "interested.*" Keys

| Key | English (en) | Spanish (es) |
|-----|-------------|--------------|
| `interested.title` | "Interested People" | "Estudios y Revisitas" |
| `interested.addNew` | "Add Person" | "Agregar Persona" |
| `interested.name` | "Name" | "Nombre" |
| `interested.lastName` | "Last Name" | "Apellido" |
| `interested.gender` | "Gender" | "Género" |
| `interested.male` | "Male" | "Masculino" |
| `interested.female` | "Female" | "Femenino" |
| `interested.age` | "Age" | "Edad" |
| `interested.address` | "Address" | "Dirección" |
| `interested.comments` | "Comments" | "Comentarios" |
| `interested.location` | "Location" | "Ubicación" |
| `interested.initialConversation` | "Initial Conversation" | "Conversación Inicial" |
| `interested.nextVisit` | "Next Visit" | "Próxima Visita" |
| `interested.status` | "Status" | "Estado" |
| `interested.bibleStudent` | "Bible Student" | "Estudiante de la Biblia" |
| `interested.returnVisit` | "Return Visit" | "Revisita" |
| `interested.interestedPerson` | "Interested Person" | "Persona Interesada" |
| `interested.selectLocation` | "Tap map to set location" | "Toca el mapa para establecer ubicación" |
| `interested.myLocation` | "My Location" | "Mi Ubicación" |
| `interested.personPin` | "Person's pin" | "Pin de la persona" |
| `interested.empty` | "No people registered yet" | "No hay personas registradas aún" |
| `interested.deleteConfirm` | "Delete this person?" | "¿Eliminar esta persona?" |
| `interested.saved` | "Person saved" | "Persona guardada" |
| `interested.deleted` | "Person deleted" | "Persona eliminada" |
| `interested.noDate` | "Not scheduled" | "No programada" |
| `interested.save` | "Save" | "Guardar" |
| `interested.cancel` | "Cancel" | "Cancelar" |
| `interested.edit` | "Edit" | "Editar" |
| `interested.delete` | "Delete" | "Eliminar" |
| `interested.all` | "All" | "Todos" |

**Total**: 30 keys. The 3 status label keys (`interested.bibleStudent`, `interested.returnVisit`, `interested.interestedPerson`) are the only ones that are status-specific.

---

## 5. Store Actions — `web/src/lib/store.ts`

### 5.1 State

```ts
interestedPeople: InterestedPerson[];  // initial: []
```

### 5.2 Actions (lines 105-108, 469, 492-496, 778-809)

#### `addInterestedPerson` (lines 778-791)

```ts
addInterestedPerson: (person) =>
  set((s) =>
    withPendingSync({
      interestedPeople: [
        ...s.interestedPeople,
        {
          ...person,           // Omit<InterestedPerson, "id" | "created_at" | "updated_at">
          id: uuid(),
          created_at: now(),
          updated_at: now(),
        },
      ],
    })
  ),
```

- Takes: `Omit<InterestedPerson, "id" | "created_at" | "updated_at">`
- Generates UUID, timestamps
- Appends to array
- Marks `hasPendingChanges = true`

#### `updateInterestedPerson` (lines 793-802)

```ts
updateInterestedPerson: (id, patch) =>
  set((s) =>
    withPendingSync({
      interestedPeople: s.interestedPeople.map((person) =>
        person.id === id
          ? { ...person, ...patch, updated_at: now() }
          : person
      ),
    })
  ),
```

- Takes: `id: string`, `patch: Partial<InterestedPerson>`
- Merges patch into matching person
- Updates `updated_at`
- Marks `hasPendingChanges = true`

#### `deleteInterestedPerson` (lines 804-809)

```ts
deleteInterestedPerson: (id) =>
  set((s) =>
    withPendingSync({
      interestedPeople: s.interestedPeople.filter((person) => person.id !== id),
    })
  ),
```

- Takes: `id: string`
- Removes from array
- Marks `hasPendingChanges = true`

### 5.3 Bulk Operations

#### `importData` (lines 841-862)

```ts
importData: (file, options) =>
  set((s) => ({
    // ...
    interestedPeople: file.interested_people ?? [],
    syncMetadata: options?.source === "remote"
      ? INITIAL_SYNC_METADATA
      : createPendingSyncMetadata(),
  })),
```

- Directly replaces the entire `interestedPeople` array
- If `source === "remote"` (Supabase pull), no pending flag set
- Otherwise marks `hasPendingChanges = true`

#### `setProfile` / `signOut` / `resetData`

All three reset `interestedPeople: []`.

#### `merge` (persist hydration, lines 908-920)

```ts
interestedPeople: p.interestedPeople ?? current.interestedPeople,
```

- Uses persisted value if available, otherwise current
- **No normalization** applied to interested people on hydration (unlike goals, settings, etc.)

---

## 6. Backup Serialization — `web/src/lib/store.ts`

### 6.1 serializeBackup (lines 927-945)

```ts
export function serializeBackup(state: {
  // ...
  interestedPeople?: InterestedPerson[];
}): BackupFile {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    // ...
    interested_people: state.interestedPeople ?? [],
  };
}
```

- Key name in JSON: `interested_people` (snake_case)
- Always included, defaults to empty array

### 6.2 BackupFile Type — `web/src/types/data.ts:123-132`

```ts
export interface BackupFile {
  version: 1;
  exported_at: string;
  profile: UserProfile | null;
  settings: AppSettings;
  service_types: ServiceType[];
  time_entries: TimeEntry[];
  goals?: GoalDefinition[];
  interested_people?: InterestedPerson[];  // optional
}
```

### 6.3 deserializeBackup (lines 947-961)

```ts
export function deserializeBackup(raw: unknown): BackupFile {
  // Validates: is object, version === 1, service_types & time_entries are arrays
  // Does NOT validate interested_people specifically
  return obj as unknown as BackupFile;
}
```

- Simple cast; trusts that `interested_people` is an array of `InterestedPerson` objects

---

## 7. Settings Page — `web/src/app/(dashboard)/settings/page.tsx`

**Relevant patterns for status config UI** (1953 lines total):

### 7.1 Category/Tab Pattern (lines 166, 439-447, 473-490)

```ts
type SettingsCategory = "account" | "appearance" | "language" | "entries" | "reports" | "data" | "danger";

const [activeCategory, setActiveCategory] = useState<SettingsCategory>("account");

const settingsCategories: Array<{ id: SettingsCategory; label: string; icon: string }> = [
  { id: "account",    label: t("settings.profile"),     icon: "person" },
  { id: "appearance", label: t("settings.appearance"),  icon: "palette" },
  { id: "language",   label: t("settings.language"),    icon: "translate" },
  { id: "entries",    label: t("settings.entriesServices"), icon: "construction" },
  { id: "reports",    label: t("settings.reportsGoals"), icon: "flag" },
  { id: "data",       label: t("settings.dataBackup"),   icon: "cloud_upload" },
  { id: "danger",     label: t("settings.dangerZone"),   icon: "warning" },
];
```

Each category section uses:
```tsx
className={cn("...", activeCategory !== "categoryId" && "hidden")}
```

### 7.2 Service Type Editing Pattern — `SortableServiceTypeItem` (lines 1754-1953)

This is the **key pattern to study** for implementing status config editing:

**Editing state**:
```ts
const [editing, setEditing] = useState(false);
const [editName, setEditName] = useState(serviceType.name);
const [editColor, setEditColor] = useState(serviceType.color);
const [editIcon, setEditIcon] = useState(serviceType.icon);
```

**Save/Cancel**:
```ts
const handleSave = () => {
  if (!editName.trim()) return;
  onUpdate({ name: editName.trim(), color: editColor, icon: editIcon, entry_type: editEntryType });
  setEditing(false);
};
const handleCancel = () => {
  setEditName(serviceType.name);
  setEditColor(serviceType.color);
  setEditIcon(serviceType.icon);
  setEditEntryType(serviceType.entry_type);
  setEditing(false);
};
```

**Color picker** (lines 1893-1912):
- 8 preset colors from `COLORS` array, rendered as `size-7 rounded-full` buttons
- Custom color via `<input type="color">` hidden inside a dashed-border label
- Active: `border-slate-900 dark:border-white scale-110`

**Icon picker** (lines 1914-1932):
- Renders `ICONS` array as `size-9 rounded-xl` buttons
- Each shows the Material Symbol icon
- Active: `border-primary bg-primary/10 text-primary`

**Drag & Drop** (lines 1022-1042):
```tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleServiceTypeDragEnd}>
  <SortableContext items={serviceTypes.map(s => s.id)} strategy={verticalListSortingStrategy}>
    {serviceTypes.map(serviceType => (
      <SortableServiceTypeItem key={serviceType.id} serviceType={serviceType} ... />
    ))}
  </SortableContext>
</DndContext>
```

Uses `@dnd-kit/core` + `@dnd-kit/sortable`. Each item has a drag handle button with `{...attributes} {...listeners}`.

### 7.3 ICONS Array (line 36-39)

```ts
const ICONS = [
  "build", "groups", "analytics", "computer",
  "phone_in_talk", "drive_eta", "home_repair_service", "engineering", "medical_services", "Auto_Stories",
];
```

10 Material Symbols icon names (one has inconsistent casing: `Auto_Stories`).

### 7.4 COLORS Array (lines 31-34)

```ts
const COLORS = [
  "#2094f3", "#f97316", "#10b981", "#8b5cf6",
  "#ef4444", "#ec4899", "#14b8a6", "#f59e0b",
];
```

8 preset hex colors.

---

## 8. Supabase Push/Pull — `web/src/lib/supabase.ts`

### 8.1 pushInterestedPeople (lines 254-281)

```ts
export async function pushInterestedPeople(items: InterestedPerson[], userId: string): Promise<void> {
  const client = getSupabase();
  // DELETE all existing rows for this user
  await client.from("interested_people").delete().eq("user_id", userId);
  // INSERT all current rows
  if (items.length === 0) return;
  const rows = items.map((p) => ({
    id: p.id,
    user_id: userId,
    name: p.name,
    last_name: p.last_name,
    gender: p.gender,
    age: p.age ?? null,
    address: p.address ?? null,
    comments: p.comments ?? null,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    initial_conversation_date: p.initial_conversation_date ?? null,
    next_visit_date: p.next_visit_date ?? null,
    status: p.status,  // <-- stored as the string literal
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
  await client.from("interested_people").insert(rows);
}
```

### 8.2 pullInterestedPeople (lines 283-310)

```ts
export async function pullInterestedPeople(userId: string): Promise<InterestedPerson[]> {
  const client = getSupabase();
  const { data } = await client
    .from("interested_people")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  return (data ?? []).map((r): InterestedPerson => ({
    id: r.id,
    name: r.name,
    last_name: r.last_name,
    gender: r.gender,
    age: r.age ?? null,
    address: r.address ?? null,
    comments: r.comments ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    initial_conversation_date: r.initial_conversation_date ?? null,
    next_visit_date: r.next_visit_date ?? null,
    status: r.status,  // <-- expects string from DB
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}
```

### 8.3 Supabase `interested_people` Table Columns

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (UUID) | Primary key |
| `user_id` | text (UUID) | FK to users |
| `name` | text | |
| `last_name` | text | |
| `gender` | text | `"male"` or `"female"` |
| `age` | integer (nullable) | |
| `address` | text (nullable) | |
| `comments` | text (nullable) | |
| `latitude` | float8 (nullable) | |
| `longitude` | float8 (nullable) | |
| `initial_conversation_date` | text (nullable) | ISO 8601 date |
| `next_visit_date` | text (nullable) | ISO 8601 date |
| `status` | text | One of the 3 string literals |
| `created_at` | text | ISO 8601 |
| `updated_at` | text | ISO 8601 |

**Important**: The `status` column stores the string literal directly (`"bible_student"`, `"return_visit"`, `"interested_person"`). There is **no separate status configuration table** — statuses are not stored as entities, only as a string field on each person.

### 8.4 Bulk Push/Pull

#### pushAll (lines 323-338)

```ts
export async function pushAll(state: SyncState, userId: string): Promise<void> {
  await pushServiceTypes(state.serviceTypes, userId);  // Phase 1: first (FK dependency)
  // Phase 2: parallel
  await Promise.all([
    pushProfile(state.profile, userId),       // if profile
    pushSettings(state.settings, userId),
    pushTimeEntries(state.timeEntries, userId),
    pushGoals(state.goals, userId),
    pushInterestedPeople(state.interestedPeople, userId),  // <-- included
  ]);
}
```

#### pullAll (lines 343-387)

```ts
export async function pullAll(userId: string): Promise<SyncState> {
  const [profileRow, settings, serviceTypes, timeEntries, goals, interestedPeople] =
    await Promise.all([
      pullProfile(userId),
      pullSettings(userId),
      pullServiceTypes(userId),
      pullTimeEntries(userId),
      pullGoals(userId),
      pullInterestedPeople(userId),  // <-- included
    ]);
  // ...
  return { profile, settings, serviceTypes, timeEntries, goals, interestedPeople };
}
```

---

## 9. Sync Provider — `web/src/lib/sync.tsx`

### 9.1 isRemoteEmpty (lines 44-56)

```ts
function isRemoteEmpty(state: {
  serviceTypes: unknown[];
  timeEntries: unknown[];
  goals: unknown[];
  interestedPeople: unknown[];
}) {
  return (
    state.serviceTypes.length === 0 &&
    state.timeEntries.length === 0 &&
    state.goals.length === 0 &&
    state.interestedPeople.length === 0
  );
}
```

Interested people count is checked alongside other collections to determine if remote is empty.

### 9.2 performSync (lines 90-117)

Reads `store.interestedPeople` into the `pushAll` call at line 109-110:
```ts
interestedPeople: store.interestedPeople,
```

### 9.3 autoSync push/pull (lines 170-235)

When pulling remote data, `interested_people: remote.interestedPeople` is included in the `importData` call as part of the `BackupFile`-shaped object at line 214.

### 9.4 SyncState Interface — `web/src/lib/supabase.ts:314-321`

```ts
export interface SyncState {
  profile: UserProfile | null;
  settings: AppSettings;
  serviceTypes: ServiceType[];
  timeEntries: TimeEntry[];
  goals: GoalDefinition[];
  interestedPeople: InterestedPerson[];
}
```

---

## 10. Summary of Hardcoded Status Values

### 10.1 Where the 3 statuses are defined/copied

| Location | File:Line | What |
|----------|-----------|------|
| Type definition | `types/data.ts:91` | `InterestedPersonStatus` union type |
| Page colors | `interested/page.tsx:20-24` | `STATUS_COLORS` Record |
| Page labels | `interested/page.tsx:26-30` | `STATUS_LABEL_KEYS` Record |
| Page filters | `interested/page.tsx:34-39` | `FILTER_OPTIONS` array |
| Modal colors | `InterestedPersonModal.tsx:21-25` | Duplicate `STATUS_COLORS` |
| Modal order | `InterestedPersonModal.tsx:27-31` | `STATUS_ORDER` array |
| Modal labels | `InterestedPersonModal.tsx:33-37` | Duplicate `STATUS_LABEL_KEYS` |
| i18n English | `i18n.tsx:279-281` | 3 translated status names |
| i18n Spanish | `i18n.tsx:569-571` | 3 translated status names |

### 10.2 What a "configurable status" would need

To make statuses customizable (name, color, icon per status), the following areas would need changes:

1. **New type**: A `StatusConfig` type with `{ id: string, name: string, color: string, icon: string }`
2. **Store**: A `statusConfigs: StatusConfig[]` array in state + CRUD actions
3. **InterestedPerson.status**: Change from string literal union to `string` (referencing a config ID)
4. **InterestedPage + Modal**: Remove hardcoded `STATUS_COLORS`, `STATUS_ORDER`, `STATUS_LABEL_KEYS`; look up config by `person.status` from the configs array
5. **Filter tabs**: Dynamically generated from configs array instead of hardcoded `FILTER_OPTIONS`
6. **Status picker in modal**: Dynamically generated from configs instead of `STATUS_ORDER`
7. **Settings page**: New category/section to manage status configs (create, edit name/color/icon, reorder, delete)
8. **i18n**: Status names would come from user-configured values instead of translation keys (or i18n keys could be used as defaults)
9. **Serialize/deserialize**: Include `status_configs` in `BackupFile`
10. **Supabase**: New `status_configs` table + `interested_people.status` column would reference config ID
11. **Migrate existing data**: Map existing `"bible_student"`, `"return_visit"`, `"interested_person"` to default config IDs

### 10.3 Existing patterns to reuse

- **ServiceType CRUD in settings** (`SortableServiceTypeItem`): Provides a ready pattern for name/color/icon editing with drag reorder
- **Settings category tabs** (`activeCategory` + grid): Pattern for adding a new section
- **ICONS array + COLORS array**: Can be shared/extracted to a common module
- **DnD with @dnd-kit**: Already used for service type reordering, can be reused for status config reordering
- **withPendingSync**: All store mutations that need sync already use this helper

---

## Appendix: File Reference Map

| # | File | Lines | Relevance |
|---|------|-------|-----------|
| 1 | `web/src/types/data.ts` | 91, 93-108, 123-132 | Type definitions |
| 2 | `web/src/app/(dashboard)/interested/page.tsx` | 20-39, 112-160 | Status rendering + filters |
| 3 | `web/src/components/interested/InterestedPersonModal.tsx` | 21-37, 273-300 | Status picker + duplicate configs |
| 4 | `web/src/lib/i18n.tsx` | 265-294 (en), 555-584 (es) | Status i18n keys |
| 5 | `web/src/lib/store.ts` | 75, 105-108, 469, 778-809, 841-862, 927-945 | State + actions + serialization |
| 6 | `web/src/lib/supabase.ts` | 254-310, 314-321, 323-338, 343-387 | Supabase push/pull |
| 7 | `web/src/lib/sync.tsx` | 44-56, 100, 109-110, 178, 188, 214 | Sync integration |
| 8 | `web/src/app/(dashboard)/settings/page.tsx` | 31-39, 166, 439-490, 1754-1953 | Settings patterns (tabs, editing, DnD, color/icon pickers) |
