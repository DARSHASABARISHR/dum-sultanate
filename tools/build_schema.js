// Regenerates database/schema.sql from tools/data.js:  node tools/build_schema.js
const B=require('./data.js'),fs=require('fs');
const q=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"''")+"'";
const head=`-- DUM SULTANATE schema. Works on MariaDB (XAMPP) and MySQL 8. Import in phpMyAdmin.
CREATE DATABASE IF NOT EXISTS dum_sultanate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dum_sultanate;
SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS review_grievances, reviews, favorites, biryanis, users;
SET FOREIGN_KEY_CHECKS=1;
CREATE TABLE users(
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_code VARCHAR(24) NOT NULL UNIQUE,
 google_sub VARCHAR(64) NOT NULL UNIQUE,
 name VARCHAR(190) NOT NULL,
 email VARCHAR(190) NOT NULL UNIQUE,
 avatar_url VARCHAR(512) NULL,
 is_admin TINYINT(1) NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_login TIMESTAMP NULL
) ENGINE=InnoDB;
CREATE TABLE biryanis(
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 slug VARCHAR(120) NOT NULL UNIQUE,
 name VARCHAR(160) NOT NULL,
 region VARCHAR(120) NOT NULL,
 description TEXT NOT NULL,
 prep_time SMALLINT UNSIGNED NOT NULL,
 cook_time SMALLINT UNSIGNED NOT NULL,
 ingredients_json JSON NOT NULL,
 steps_json JSON NOT NULL
) ENGINE=InnoDB;
CREATE TABLE favorites(
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NOT NULL,
 biryani_id INT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_fav(user_id,biryani_id),
 CONSTRAINT fk_fav_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_fav_biryani FOREIGN KEY(biryani_id) REFERENCES biryanis(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE reviews(
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NOT NULL,
 biryani_id INT UNSIGNED NOT NULL,
 rating TINYINT UNSIGNED NOT NULL,
 highlights VARCHAR(255) NULL,
 complaints_improvements TEXT NULL,
 comments TEXT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_rev_biryani(biryani_id),
 INDEX idx_rev_user(user_id),
 CONSTRAINT fk_rev_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_rev_biryani FOREIGN KEY(biryani_id) REFERENCES biryanis(id) ON DELETE CASCADE,
 CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;
CREATE TABLE review_grievances(
 review_id INT UNSIGNED NOT NULL,
 tag VARCHAR(40) NOT NULL,
 PRIMARY KEY(review_id,tag),
 INDEX idx_tag(tag),
 CONSTRAINT fk_gr_review FOREIGN KEY(review_id) REFERENCES reviews(id) ON DELETE CASCADE
) ENGINE=InnoDB;
`;
const rows=B.map(b=>`(${[b.slug,b.name,b.region,b.description].map(q).join(',')},${b.prep_time},${b.cook_time},${q(JSON.stringify(b.ingredients))},${q(JSON.stringify(b.steps))})`).join(',\n');
fs.writeFileSync(__dirname+'/../database/schema.sql',head+`INSERT INTO biryanis(slug,name,region,description,prep_time,cook_time,ingredients_json,steps_json) VALUES\n${rows};\n`);
