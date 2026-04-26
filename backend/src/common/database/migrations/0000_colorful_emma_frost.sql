CREATE TYPE "public"."bracelet_assignment_status" AS ENUM('active', 'revoked', 'replaced');--> statement-breakpoint
CREATE TYPE "public"."event_member_role" AS ENUM('admin', 'operator');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'setup', 'active', 'settlement', 'closed');--> statement-breakpoint
CREATE TYPE "public"."event_ticket_status" AS ENUM('pending', 'redeemed', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_intent_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('completed', 'pending', 'failed', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."vendor_member_role" AS ENUM('owner', 'manager', 'cashier');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text,
	"user_id" text NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" text NOT NULL,
	"changes" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" varchar(255) NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"phone" varchar(50),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_bracelets" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"wristband_uid" varchar(255) NOT NULL,
	"status" "bracelet_assignment_status" DEFAULT 'active' NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"debit_counter_seen" integer DEFAULT 0 NOT NULL,
	"credit_counter" integer DEFAULT 0 NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"linked_by" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"revoke_reason" text,
	"replaced_by_assignment_id" text,
	"token_issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"token_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_bracelets_balance_check" CHECK ("event_bracelets"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "event_members" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "event_member_role" NOT NULL,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_members_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "event_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"user_id" text,
	"token" text NOT NULL,
	"status" "event_ticket_status" DEFAULT 'pending' NOT NULL,
	"issued_by" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"redeemed_bracelet_id" text,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"organizer_id" text NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"token_currency_rate" numeric(10, 4) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"timezone" varchar(50) DEFAULT 'Europe/Bucharest' NOT NULL,
	"location" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "events_dates_check" CHECK ("events"."start_date" < "events"."end_date"),
	CONSTRAINT "events_token_rate_check" CHECK ("events"."token_currency_rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"business_name" varchar(255) NOT NULL,
	"contact_person" varchar(255) NOT NULL,
	"contact_email" varchar(255),
	"product_type" varchar(50),
	"description" text,
	"status" "vendor_status" DEFAULT 'pending' NOT NULL,
	"commission_rate" numeric(5, 2),
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_user_event_unique" UNIQUE("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "vendor_members" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "vendor_member_role" NOT NULL,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_members_unique" UNIQUE("vendor_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"event_bracelet_id" text NOT NULL,
	"vendor_id" text,
	"operator_id" text,
	"type" "transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"status" "transaction_status" DEFAULT 'completed' NOT NULL,
	"offline" boolean DEFAULT false NOT NULL,
	"debit_counter" integer,
	"credit_counter" integer,
	"client_timestamp" timestamp with time zone,
	"server_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "transactions_amount_check" CHECK ("transactions"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_bracelet_id" text NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_intent_id" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "payment_intent_status" DEFAULT 'pending' NOT NULL,
	"transaction_id" text,
	"metadata" jsonb,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_intents_provider_intent_id_unique" UNIQUE("provider_intent_id"),
	CONSTRAINT "payment_intents_amount_check" CHECK ("payment_intents"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_bracelets" ADD CONSTRAINT "event_bracelets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_bracelets" ADD CONSTRAINT "event_bracelets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_bracelets" ADD CONSTRAINT "event_bracelets_linked_by_user_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_bracelets" ADD CONSTRAINT "event_bracelets_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_issued_by_user_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_redeemed_bracelet_id_event_bracelets_id_fk" FOREIGN KEY ("redeemed_bracelet_id") REFERENCES "public"."event_bracelets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_user_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_members" ADD CONSTRAINT "vendor_members_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_members" ADD CONSTRAINT "vendor_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_members" ADD CONSTRAINT "vendor_members_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_event_bracelet_id_event_bracelets_id_fk" FOREIGN KEY ("event_bracelet_id") REFERENCES "public"."event_bracelets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_operator_id_user_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_event_bracelet_id_event_bracelets_id_fk" FOREIGN KEY ("event_bracelet_id") REFERENCES "public"."event_bracelets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_event_created_idx" ON "audit_logs" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_bracelets_active_uid_idx" ON "event_bracelets" USING btree ("event_id","wristband_uid") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "event_bracelets_active_user_idx" ON "event_bracelets" USING btree ("event_id","user_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "event_bracelets_event_idx" ON "event_bracelets" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_bracelets_user_idx" ON "event_bracelets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_bracelets_status_idx" ON "event_bracelets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_members_event_id_idx" ON "event_members" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_members_user_id_idx" ON "event_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_tickets_token_idx" ON "event_tickets" USING btree ("token");--> statement-breakpoint
CREATE INDEX "event_tickets_event_idx" ON "event_tickets" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_tickets_email_idx" ON "event_tickets" USING btree ("email");--> statement-breakpoint
CREATE INDEX "event_tickets_status_idx" ON "event_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_tickets_event_email_idx" ON "event_tickets" USING btree ("event_id","email");--> statement-breakpoint
CREATE INDEX "events_organizer_id_idx" ON "events" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_dates_idx" ON "events" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "vendors_event_id_idx" ON "vendors" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "vendors_event_status_idx" ON "vendors" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "vendors_user_id_idx" ON "vendors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vendor_members_vendor_id_idx" ON "vendor_members" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_members_user_id_idx" ON "vendor_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_bracelet_idx" ON "transactions" USING btree ("event_bracelet_id");--> statement-breakpoint
CREATE INDEX "transactions_vendor_idx" ON "transactions" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "transactions_created_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "payment_intents_user_id_idx" ON "payment_intents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_intents_bracelet_id_idx" ON "payment_intents" USING btree ("event_bracelet_id");--> statement-breakpoint
CREATE INDEX "payment_intents_status_idx" ON "payment_intents" USING btree ("status");