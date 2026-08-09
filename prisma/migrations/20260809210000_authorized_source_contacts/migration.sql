-- Yazılı kaynak yetkisi CONTACT_READ kapsamını içerdiğinde, detay sayfasında
-- görünür olan iletişim bilgisini diğer sağlayıcı türlerinden ayırır.
ALTER TYPE "HuntedContactSourceType"
  ADD VALUE IF NOT EXISTS 'AUTHORIZED_SOURCE';
