-- --------------------------------------------------------
-- Servidor:                     127.0.0.1
-- Versão do servidor:           12.0.2-MariaDB - mariadb.org binary distribution
-- OS do Servidor:               Win64
-- HeidiSQL Versão:              12.11.0.7065
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Copiando estrutura do banco de dados para whatsapp_bot
CREATE DATABASE IF NOT EXISTS `whatsapp_bot` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;
USE `whatsapp_bot`;

-- Copiando estrutura para tabela whatsapp_bot.orders
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(20) NOT NULL,
  `status` varchar(50) DEFAULT 'Pending',
  `shipping_address` varchar(255) DEFAULT NULL,
  `payer_id` varchar(255) DEFAULT NULL,
  `payer_email` varchar(255) DEFAULT NULL,
  `amount` float NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `FK_orders_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`phone_number`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela whatsapp_bot.orders: ~0 rows (aproximadamente)

-- Copiando estrutura para tabela whatsapp_bot.order_products
CREATE TABLE IF NOT EXISTS `order_products` (
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`order_id`,`product_id`),
  KEY `FK_order_products_products` (`product_id`),
  CONSTRAINT `FK_order_products_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_order_products_products` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela whatsapp_bot.order_products: ~0 rows (aproximadamente)

-- Copiando estrutura para tabela whatsapp_bot.products
CREATE TABLE IF NOT EXISTS `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `color` varchar(255) DEFAULT NULL,
  `price` float NOT NULL DEFAULT 0,
  `quantity` int(11) DEFAULT 0,
  `image_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela whatsapp_bot.products: ~4 rows (aproximadamente)
INSERT INTO `products` (`id`, `title`, `color`, `price`, `quantity`, `image_url`, `created_at`, `updated_at`) VALUES
	(1, 'Camiseta Verde', 'verde', 5, 95, 'https://unscorched-unskeptically-leisha.ngrok-free.dev/images/green-t-shirt.jpg', '2025-10-07 02:22:36', '2025-10-07 02:52:54'),
	(2, 'Calça Azul', 'azul', 10, 95, 'https://unscorched-unskeptically-leisha.ngrok-free.dev/images/blue-pants.jpg', '2025-10-07 02:22:36', '2025-10-07 02:52:54'),
	(3, 'Camiseta Vermelha', 'vermelha', 5, 94, 'https://unscorched-unskeptically-leisha.ngrok-free.dev/images/red-t-shirt.jpg', '2025-10-07 02:22:36', '2025-10-07 03:09:48'),
	(4, 'Calça Verde', 'verde', 10, 94, 'https://unscorched-unskeptically-leisha.ngrok-free.dev/images/green-pants.jpg', '2025-10-07 02:22:36', '2025-10-07 02:52:54');

-- Copiando estrutura para tabela whatsapp_bot.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `phone_number` varchar(20) NOT NULL,
  `state` varchar(50) DEFAULT 'greeting',
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` varchar(500) DEFAULT NULL,
  `last_shown_products` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`last_shown_products`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone_number` (`phone_number`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela whatsapp_bot.users: ~0 rows (aproximadamente)

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
