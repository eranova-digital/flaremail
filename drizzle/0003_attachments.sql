ALTER TABLE "messages" ADD COLUMN "has_attachments" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"message_id" uuid NOT NULL,
	"filename" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"disposition" text,
	"content_id" text,
	"storage_key" text NOT NULL,
	CONSTRAINT "attachments_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;
