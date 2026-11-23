import { supabase } from "@/integrations/supabase/client";
import type { CheckView } from "@/lib/check-scoring";

export interface CheckMatchRow {
  match_id: string;
  home: string;
  away: string;
  status: string;
  when_at: string | null;
  checker: boolean;
  open_flags: number;
  checkers: number;
  confirmed: boolean;
}

export function friendlyCheck(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String((reason as { message?: unknown })?.message ?? reason ?? "");
  if (/no CricLume account/i.test(message)) return "No CricLume account uses that email yet. Ask them to sign up first.";
  if (/active member of the away club/i.test(message)) return "The check scorer must be an active member of the away club.";
  if (/already scores this match/i.test(message)) return "That person already scores this match, so they can't also check it.";
  if (/at most two/i.test(message)) return "A match can have at most two check scorers.";
  if (/open queries/i.test(message)) return "Some queries still need an answer from the scorer.";
  if (/too many open/i.test(message)) return "There are a lot of open queries. Wait for the scorer to answer some first.";
  if (/say what looks wrong/i.test(message)) return "Say what looks wrong (at least a few words).";
  if (/not checking this match|only this match's check scorer|permission|42501|doesn't allow/i.test(message))
    return "Your role doesn't allow that for this match.";
  return "That didn't save. Check your connection and try again.";
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  // The generated types know these functions; the loose call keeps this helper small.
  const { data, error } = await (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: T; error: { message: string } | null }>)(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export const loadCheckMatches = () => rpc<CheckMatchRow[]>("list_my_check_matches", {});
export const loadCheckView = (matchId: string) => rpc<CheckView>("check_scoring_view", { p_match_id: matchId });
export const addCheckScorer = (matchId: string, email: string) =>
  rpc<string>("add_match_check_scorer", { p_match_id: matchId, p_email: email });
export const removeCheckScorer = (matchId: string, userId: string) =>
  rpc<null>("remove_match_check_scorer", { p_match_id: matchId, p_user_id: userId });
export const raiseCheckFlag = (matchId: string, deliveryId: string | null, note: string) =>
  rpc<string>("raise_check_flag", { p_match_id: matchId, p_delivery_id: deliveryId, p_note: note });
export const answerCheckFlag = (flagId: string, status: "fixed" | "kept", reply: string) =>
  rpc<null>("resolve_check_flag", { p_flag_id: flagId, p_status: status, p_reply: reply });
export const confirmScorecard = (matchId: string, note: string) =>
  rpc<null>("confirm_check_scorecard", { p_match_id: matchId, p_note: note });
