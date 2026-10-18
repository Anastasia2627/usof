import {
  restrictAccount, liftRestriction, getRestrictionStatus, appealRestriction,
  listRestrictionAppeals, reviewRestrictionAppeal,
} from '../services/banService.js';

export async function banUser(req,res) {
  res.json(await restrictAccount(req.params.user_id,req.user,req.body));
}
export async function unbanUser(req,res) {
  res.json(await liftRestriction(req.params.user_id,req.user));
}
export async function banStatus(req,res) {
  res.json(await getRestrictionStatus(req.user.sub));
}
export async function submitAppeal(req,res) {
  res.status(201).json(await appealRestriction(req.user.sub,req.body));
}
export async function listAppeals(req,res) {
  res.json(await listRestrictionAppeals());
}
export async function reviewAppeal(req,res) {
  res.json(await reviewRestrictionAppeal(req.params.appeal_id,req.user,req.body));
}
