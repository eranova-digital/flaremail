ALTER TABLE "attachments" DROP CONSTRAINT "attachments_message_id_messages_id_fk";--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" DROP CONSTRAINT "labels_mailbox_id_mailboxes_id_fk";--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_matched_mailbox_id_mailboxes_id_fk";--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_matched_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("matched_mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE set null ON UPDATE no action;
