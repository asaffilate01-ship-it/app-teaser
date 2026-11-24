import { useState, type FormEvent } from "react";
import { PackagePlus, ShoppingBag } from "lucide-react";
import { can } from "@/lib/platform";
import { availableToLend, formatMoney, toMinor } from "@/lib/club-office";
import { office, type ClubItem, type ItemOrder } from "@/lib/club-office-cloud";
import {
  Empty,
  OfficeCard,
  OfficeField,
  Pill,
  currencies,
  day,
  nameOfMember,
  nameOfPlayer,
  type OfficeProps,
} from "./ui";

const nextStatus: Partial<Record<ItemOrder["status"], ItemOrder["status"]>> = {
  requested: "approved",
  approved: "paid",
  paid: "ready",
  ready: "collected",
};
const statusLabel: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  paid: "Paid",
  ready: "Ready to collect",
  collected: "Collected",
  cancelled: "Cancelled",
};

export function StorePanel(props: OfficeProps) {
  const { data, role } = props;
  const manager = can(role, "store.manage");
  const items = data.items.filter((item) => item.active || manager);
  return (
    <div className="space-y-4">
      {manager && <NewItem {...props} />}
      <OfficeCard
        title="Club shop and kit"
        description="Order kit here and pay the club in person. Online card payments aren't switched on yet."
      >
        {items.length === 0 ? (
          <Empty>No items yet.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} {...props} />
            ))}
          </div>
        )}
      </OfficeCard>
      <Orders {...props} />
      {manager && <Loans {...props} />}
      {!manager && <MyLoans {...props} />}
    </div>
  );
}

function ItemCard({
  item,
  data,
  club,
  role,
  organisationId,
  act,
}: OfficeProps & { item: ClubItem }) {
  const manager = can(role, "store.manage");
  const [size, setSize] = useState(item.sizes[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [playerId, setPlayerId] = useState(data.myPlayerIds[0] ?? "");
  const free = availableToLend(
    item.stock,
    data.loans
      .filter((loan) => loan.item_id === item.id)
      .map((loan) => ({ quantity: loan.quantity, returnedAt: loan.returned_at })),
  );
  return (
    <div className="office-row flex-col items-stretch">
      <div className="flex items-start justify-between gap-2">
        <span>
          <span className="font-bold">{item.name}</span>
          <span className="office-meta block">{item.description}</span>
        </span>
        <Pill>{item.kind === "equipment" ? "Equipment" : "Merchandise"}</Pill>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {item.price_minor != null && item.currency && (
          <strong>{formatMoney(Number(item.price_minor), item.currency)}</strong>
        )}
        <Pill tone={item.stock > 0 ? "good" : "bad"}>{item.stock} in stock</Pill>
        {item.loanable && <Pill>{free} free to borrow</Pill>}
        {!item.active && <Pill tone="warn">Hidden</Pill>}
      </div>
      {item.active && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void act(
              () =>
                office.order({
                  organisationId,
                  itemId: item.id,
                  userId: data.userId,
                  playerId: playerId || null,
                  quantity,
                  size: size || null,
                }),
              "Order sent to the club",
            );
          }}
        >
          {item.sizes.length > 0 && (
            <select
              aria-label="Size"
              className="scorer-input h-10 w-24"
              value={size}
              onChange={(event) => setSize(event.target.value)}
            >
              {item.sizes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          )}
          <input
            aria-label="Quantity"
            type="number"
            min={1}
            max={50}
            className="scorer-input h-10 w-20"
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
          />
          {data.myPlayerIds.length > 0 && (
            <select
              aria-label="For"
              className="scorer-input h-10 w-36"
              value={playerId}
              onChange={(event) => setPlayerId(event.target.value)}
            >
              <option value="">For me</option>
              {data.myPlayerIds.map((id) => (
                <option key={id} value={id}>
                  {nameOfPlayer(club, id)}
                </option>
              ))}
            </select>
          )}
          <button className="action-secondary">
            <ShoppingBag className="size-4" /> Order
          </button>
        </form>
      )}
      {manager && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="app-chip-button"
            onClick={() => {
              const value = window.prompt("Stock count", String(item.stock));
              if (value != null && /^\d+$/.test(value))
                void act(
                  () => office.updateItem(item.id, { stock: Number(value) }),
                  "Stock updated",
                );
            }}
          >
            Set stock
          </button>
          <button
            type="button"
            className="app-chip-button"
            onClick={() => void act(() => office.updateItem(item.id, { active: !item.active }))}
          >
            {item.active ? "Hide" : "Show"}
          </button>
        </div>
      )}
    </div>
  );
}

function NewItem({ data, organisationId, act }: OfficeProps) {
  const [kind, setKind] = useState<"merchandise" | "equipment">("merchandise");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState(
    data.schedules[0]?.currency ?? data.items.find((item) => item.currency)?.currency ?? "GBP",
  );
  const [sizes, setSizes] = useState("");
  const [stock, setStock] = useState(0);
  const [loanable, setLoanable] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await act(
      () =>
        office.addItem({
          organisation_id: organisationId,
          kind,
          name: name.trim(),
          description: description.trim() || null,
          price_minor: price ? toMinor(price, currency) : null,
          currency: price ? currency : null,
          sizes: sizes
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, 20),
          stock,
          loanable: kind === "equipment" && loanable,
        }),
      "Item added",
    );
    if (ok) {
      setName("");
      setDescription("");
    }
  };
  return (
    <OfficeCard
      title="Add kit or equipment"
      description="Shirts, caps and hoodies to sell, or club bats, pads and helmets to lend."
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <OfficeField label="Type">
          <select
            className="scorer-input"
            value={kind}
            onChange={(event) => setKind(event.target.value as "merchandise" | "equipment")}
          >
            <option value="merchandise">Merchandise</option>
            <option value="equipment">Equipment</option>
          </select>
        </OfficeField>
        <OfficeField label="Name">
          <input
            required
            maxLength={120}
            className="scorer-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Playing shirt"
          />
        </OfficeField>
        <OfficeField label="Price (optional)">
          <input
            inputMode="decimal"
            className="scorer-input"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </OfficeField>
        <OfficeField label="Currency">
          <select
            className="scorer-input"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {currencies.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </OfficeField>
        <OfficeField label="Sizes (comma separated)">
          <input
            maxLength={200}
            className="scorer-input"
            value={sizes}
            onChange={(event) => setSizes(event.target.value)}
            placeholder="S, M, L, XL"
          />
        </OfficeField>
        <OfficeField label="Stock">
          <input
            type="number"
            min={0}
            className="scorer-input"
            value={stock}
            onChange={(event) => setStock(Math.max(0, Number(event.target.value) || 0))}
          />
        </OfficeField>
        <OfficeField label="Description">
          <input
            maxLength={500}
            className="scorer-input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </OfficeField>
        <div className="flex items-end gap-3">
          {kind === "equipment" && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={loanable}
                onChange={(event) => setLoanable(event.target.checked)}
              />{" "}
              Can be lent
            </label>
          )}
          <button className="action-primary flex-1">
            <PackagePlus className="size-4" /> Add
          </button>
        </div>
      </form>
    </OfficeCard>
  );
}

function Orders({ data, club, role, act }: OfficeProps) {
  const manager = can(role, "store.manage");
  const open = data.orders.filter(
    (order) => order.status !== "collected" && order.status !== "cancelled",
  );
  if (!open.length) return null;
  return (
    <OfficeCard title={manager ? "Orders to handle" : "My orders"}>
      <div className="space-y-2">
        {open.map((order) => {
          const item = data.items.find((row) => row.id === order.item_id);
          const next = nextStatus[order.status as ItemOrder["status"]];
          return (
            <div key={order.id} className="office-row">
              <span>
                <span className="font-bold">
                  {order.quantity} × {item?.name ?? "Item"}
                  {order.size ? ` (${order.size})` : ""}
                </span>
                <span className="office-meta block">
                  {manager ? nameOfMember(club, order.ordered_by) : "You"}
                  {order.player_id ? ` for ${nameOfPlayer(club, order.player_id)}` : ""} ·{" "}
                  {day(order.created_at)}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Pill tone={order.status === "ready" ? "good" : "warn"}>
                  {statusLabel[order.status]}
                </Pill>
                {manager && next && (
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() =>
                      void act(
                        () => office.setOrder(order.id, next),
                        `Marked ${statusLabel[next]?.toLowerCase()}`,
                      )
                    }
                  >
                    Mark {statusLabel[next]?.toLowerCase()}
                  </button>
                )}
                {(manager || order.status === "requested") && (
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() =>
                      void act(() => office.setOrder(order.id, "cancelled"), "Order cancelled")
                    }
                  >
                    Cancel
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </OfficeCard>
  );
}

function Loans({ data, club, organisationId, act }: OfficeProps) {
  const loanable = data.items.filter((item) => item.loanable);
  const [itemId, setItemId] = useState(loanable[0]?.id ?? "");
  const [playerId, setPlayerId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [due, setDue] = useState("");
  const out = data.loans.filter((loan) => !loan.returned_at);
  return (
    <OfficeCard title="Equipment on loan" description="You can't lend more than you have.">
      {loanable.length > 0 && (
        <form
          className="mb-3 grid gap-2 sm:grid-cols-[1.2fr_1.2fr_5rem_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!itemId || !playerId) return;
            void act(
              () =>
                office.lend({
                  organisation_id: organisationId,
                  item_id: itemId,
                  player_id: playerId,
                  quantity,
                  due_back_on: due || null,
                }),
              "Loan recorded",
            );
          }}
        >
          <select
            aria-label="Item"
            className="scorer-input"
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
          >
            {loanable.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Player"
            required
            className="scorer-input"
            value={playerId}
            onChange={(event) => setPlayerId(event.target.value)}
          >
            <option value="">Choose player</option>
            {club.players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
          <input
            aria-label="How many"
            type="number"
            min={1}
            max={20}
            className="scorer-input"
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
          />
          <input
            aria-label="Due back"
            type="date"
            className="scorer-input"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          />
          <button className="action-primary">Lend</button>
        </form>
      )}
      {out.length === 0 ? (
        <Empty>Nothing out on loan.</Empty>
      ) : (
        <div className="space-y-2">
          {out.map((loan) => {
            const late =
              loan.due_back_on && loan.due_back_on < new Date().toISOString().slice(0, 10);
            return (
              <div key={loan.id} className="office-row">
                <span>
                  <span className="font-bold">
                    {loan.quantity} ×{" "}
                    {data.items.find((item) => item.id === loan.item_id)?.name ?? "Item"}
                  </span>
                  <span className="office-meta block">
                    {nameOfPlayer(club, loan.player_id)}
                    {loan.due_back_on ? ` · due back ${day(loan.due_back_on)}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  {late && <Pill tone="bad">Overdue</Pill>}
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() => {
                      const note = window.prompt("Condition when returned (optional)") ?? "";
                      void act(() => office.returned(loan.id, note), "Marked returned");
                    }}
                  >
                    Returned
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </OfficeCard>
  );
}

function MyLoans({ data, club }: OfficeProps) {
  const out = data.loans.filter((loan) => !loan.returned_at);
  if (!out.length) return null;
  return (
    <OfficeCard title="Borrowed club kit">
      <div className="space-y-2">
        {out.map((loan) => (
          <div key={loan.id} className="office-row">
            <span className="font-bold">
              {data.items.find((item) => item.id === loan.item_id)?.name ?? "Item"}
            </span>
            <span className="office-meta">
              {nameOfPlayer(club, loan.player_id)}
              {loan.due_back_on ? ` · back by ${day(loan.due_back_on)}` : ""}
            </span>
          </div>
        ))}
      </div>
    </OfficeCard>
  );
}
