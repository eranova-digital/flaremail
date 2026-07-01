ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_in_reply_to_messages_message_id_fk";--> statement-breakpoint
CREATE INDEX "messages_thread_id_received_at_idx" ON "messages" USING btree ("thread_id","received_at");--> statement-breakpoint
CREATE INDEX "messages_received_at_idx" ON "messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "attachments_message_id_idx" ON "attachments" USING btree ("message_id");
