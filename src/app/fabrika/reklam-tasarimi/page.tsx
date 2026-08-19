import PosterMaker from '@/components/fabrika/PosterMaker';
import styles from './reklam-tasarimi.module.css';

export default function AdvertisingDesignPage() {
  return (
    <main className={styles.page}>
      <PosterMaker />
    </main>
  );
}
