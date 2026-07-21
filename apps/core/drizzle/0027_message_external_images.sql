CREATE TABLE "message_external_images" (
	"id" uuid PRIMARY KEY NOT NULL,
	"message_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"cache_key" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"fetched" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_external_images" ADD CONSTRAINT "message_external_images_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_external_images_message_id_idx" ON "message_external_images" USING btree ("message_id");
