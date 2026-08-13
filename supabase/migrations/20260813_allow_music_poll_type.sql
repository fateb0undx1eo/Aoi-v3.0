-- Only keep the VS and Music poll types; the studio will rework the others.
-- Replace the original (vs/wyr/choice) check with one that permits vs + music,
-- and update the column default accordingly.

alter table visual_polls
  drop constraint if exists visual_polls_type_check;

alter table visual_polls
  add constraint visual_polls_type_check
  check (type in ('vs', 'music'));

alter table visual_polls
  alter column type set default 'vs';

