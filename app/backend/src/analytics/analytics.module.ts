import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEventsService } from './analytics-events.service';

@Module({
  imports: [SupabaseModule, ApiKeysModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsEventsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

