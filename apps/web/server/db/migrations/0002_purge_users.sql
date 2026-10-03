-- Discord sign-in replaces e-mail accounts; existing (test) accounts cannot be mapped and are
-- removed together with their plans, files and shares. The arena row is recreated by the seed.
DELETE FROM "arena";
--> statement-breakpoint
DELETE FROM "users";
