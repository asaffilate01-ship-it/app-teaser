import { useState } from "react";
import { can, platformRoles, roleLabels } from "@/lib/platform";
import { officeAccess, officeAreas, type AccessLevel } from "@/lib/club-office";
import { office } from "@/lib/club-office-cloud";
import { Empty, OfficeCard, Pill, nameOfMember, nameOfPlayer, type OfficeProps } from "./ui";

const levelText: Record<AccessLevel, string> = { manage: "Runs it", request: "Can request", own: "Own / family only" };
const levelTone: Record<AccessLevel, "good" | "warn" | undefined> = { manage: "good", request: "warn", own: undefined };

export function AccessPanel(props: OfficeProps) {
  const { role } = props;
  const mine = officeAccess(role);
  return (
    <div className="space-y-4">
      <OfficeCard
        title="Your access"
        description={`You're signed in as ${roleLabels[role]}. Every rule below is enforced by the club's database, not just hidden on screen.`}
      >
        <div className="flex flex-wrap gap-1.5">
          {officeAreas.map(([area, label]) => (
            <Pill key={area} tone={levelTone[mine[area]]}>
              {label}: {levelText[mine[area]]}
            </Pill>
          ))}
        </div>
      </OfficeCard>
      <OfficeCard title="Who can do what" description="Change someone's role from Operations → Members. Admins can only manage roles below their own, and nobody can change their own role.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr>
                <th className="office-label py-2 pr-3">Role</th>
                {officeAreas.map(([area, label]) => (
                  <th key={area} className="office-label py-2 pr-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {platformRoles.map((item) => {
                const access = officeAccess(item);
                return (
                  <tr key={item} className="border-t border-border">
                    <td className="py-2 pr-3 font-bold">{roleLabels[item]}</td>
                    {officeAreas.map(([area]) => (
                      <td key={area} className="py-2 pr-3">
                        <Pill tone={levelTone[access[area]]}>{levelText[access[area]]}</Pill>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="office-meta mt-3">
          Junior lifts also need a driver approved by an owner or safeguarding officer, plus a parent's yes. Team sheets stay hidden until published. Other clubs never see who booked your ground.
        </p>
      </OfficeCard>
      {can(role, "guardians.manage") && <Family {...props} />}
    </div>
  );
}

function Family({ data, club, organisationId, act }: OfficeProps) {
  const [playerId, setPlayerId] = useState("");
  const [userId, setUserId] = useState("");
  const [relationship, setRelationship] = useState("parent");
  const players = [...club.players].sort((a, b) => Number(b.isJunior) - Number(a.isJunior) || a.name.localeCompare(b.name));
  return (
    <OfficeCard
      title="Parents and guardians"
      description="Link a parent's login to their child so they can answer availability, see fees and book lifts. Invite the parent as a Member / parent first."
    >
      <form
        className="mb-3 grid gap-2 sm:grid-cols-[1.2fr_1.2fr_9rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!playerId || !userId) return;
          void act(() => office.linkGuardian({ organisationId, playerId, userId, relationship }), "Parent linked").then((ok) => ok && setUserId(""));
        }}
      >
        <select aria-label="Player" required className="scorer-input" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
          <option value="">Choose player</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
              {player.isJunior ? " (junior)" : ""}
            </option>
          ))}
        </select>
        <select aria-label="Parent or guardian" required className="scorer-input" value={userId} onChange={(event) => setUserId(event.target.value)}>
          <option value="">Choose member</option>
          {club.members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.displayName}
            </option>
          ))}
        </select>
        <select aria-label="Relationship" className="scorer-input" value={relationship} onChange={(event) => setRelationship(event.target.value)}>
          <option value="parent">Parent</option>
          <option value="guardian">Guardian</option>
          <option value="carer">Carer</option>
        </select>
        <button className="action-primary">Link</button>
      </form>
      {data.guardians.length === 0 ? (
        <Empty>No parents linked yet.</Empty>
      ) : (
        <div className="space-y-2">
          {data.guardians.map((link) => (
            <div key={link.id} className="office-row">
              <span>
                <span className="font-bold">{nameOfMember(club, link.user_id)}</span>
                <span className="office-meta block">
                  {link.relationship} of {nameOfPlayer(club, link.player_id)}
                </span>
              </span>
              <button type="button" className="app-chip-button" onClick={() => void act(() => office.unlinkGuardian(link.id), "Link removed")}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </OfficeCard>
  );
}
