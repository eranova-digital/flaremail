CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_address" varchar(320) NOT NULL,
	"to_address" varchar(320) NOT NULL,
	"subject" text,
	"text_body" text,
	"html_body" text,
	"message_id" text NOT NULL,
	"in_reply_to" text,
	"references" text[],
	"reply_to" varchar(320),
	"cc" text,
	"raw_size" integer NOT NULL,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_in_reply_to_messages_message_id_fk" FOREIGN KEY ("in_reply_to") REFERENCES "public"."messages"("message_id") ON DELETE no action ON UPDATE no action;