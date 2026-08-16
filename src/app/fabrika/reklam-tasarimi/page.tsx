import { BadgeCheck, ImagePlus, Sparkles } from 'lucide-react';
import PosterMaker from '@/components/fabrika/PosterMaker';
import styles from './reklam-tasarimi.module.css';

export default function AdvertisingDesignPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            <Sparkles aria-hidden="true" /> AI Reklam Tasarımı
          </span>
          <h1>Portföyünüzden profesyonel reklam tasarlayın.</h1>
          <p>
            Portföyü seçin, fotoğrafları kontrol edin ve sosyal medyaya hazır
            post veya hikâye tasarımını birkaç adımda oluşturun.
          </p>
        </div>
        <div className={styles.promise}>
          <span><ImagePlus aria-hidden="true" /></span>
          <div>
            <strong>Poster üretim alanı</strong>
            <small>Gerçek fotoğraflı veya kreatif AI tasarımı</small>
          </div>
          <BadgeCheck aria-hidden="true" />
        </div>
      </header>

      <section className={styles.workspace} aria-label="Reklam tasarımı çalışma alanı">
        <PosterMaker />
      </section>
    </main>
  );
}
