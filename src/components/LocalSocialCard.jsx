import { memo, useMemo } from 'react';
import { Users } from 'lucide-react';
import { computeLocalSocialStats } from '../lib/localSocial.js';

export default memo(function LocalSocialCard({ challenge, trades, settings }) {
  const enabled = Number(settings?.local_social_enabled) === 1;
  const stats = useMemo(
    () =>
      computeLocalSocialStats(
        challenge,
        trades,
        settings?.local_social_best_profit ?? 0,
      ),
    [challenge, settings?.local_social_best_profit, trades],
  );

  if (!enabled || !challenge?.id) return null;

  return (
    <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase text-pink-200">
        <Users className="h-3 w-3" />
        Challenge social local
      </p>
      <p className="mt-1 text-[10px] text-slate-400">
        Record perso meilleur jour :{' '}
        <span className="tabular-nums text-slate-200">
          {stats.personalRecord.toLocaleString('fr-FR')} $
        </span>
        · actuel {stats.bestDayPnl.toLocaleString('fr-FR')} $ (
        {stats.currentBestVsRecordPct} % du record)
      </p>
      <p className="text-[10px] text-slate-500">
        {stats.tradesClosed} trades clôturés · {stats.activeDays} jours actifs
      </p>
    </div>
  );
});
