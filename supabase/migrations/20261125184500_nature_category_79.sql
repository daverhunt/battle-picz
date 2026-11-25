-- Deploy the committed 79 Nature images before activating the catalogue.
-- Picture IDs and paths are stable; repeating migration is safe.
insert into public.categories (id,name,price,sort_order) values ('NATURE','Nature',20,13)
on conflict (id) do update set name=excluded.name, price=excluded.price;
insert into public.category_pictures(id,category_id,question,active) values ('nature:acorn','NATURE','{"id":"nature:acorn","a":"ACORN","label":"ACORN","pic":"🖼️","image":"assets/images/categories/nature/acorn.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:ant','NATURE','{"id":"nature:ant","a":"ANT","label":"ANT","pic":"🖼️","image":"assets/images/categories/nature/ant.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:arch','NATURE','{"id":"nature:arch","a":"ARCH","label":"ARCH","pic":"🖼️","image":"assets/images/categories/nature/arch.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:aurora','NATURE','{"id":"nature:aurora","a":"AURORA","label":"AURORA","pic":"🖼️","image":"assets/images/categories/nature/aurora.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:bark','NATURE','{"id":"nature:bark","a":"BARK","label":"BARK","pic":"🖼️","image":"assets/images/categories/nature/bark.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:beach','NATURE','{"id":"nature:beach","a":"BEACH","label":"BEACH","pic":"🖼️","image":"assets/images/categories/nature/beach.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:bee','NATURE','{"id":"nature:bee","a":"BEE","label":"BEE","pic":"🖼️","image":"assets/images/categories/nature/bee.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:beetle','NATURE','{"id":"nature:beetle","a":"BEETLE","label":"BEETLE","pic":"🖼️","image":"assets/images/categories/nature/beetle.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:berries','NATURE','{"id":"nature:berries","a":"BERRIES","label":"BERRIES","pic":"🖼️","image":"assets/images/categories/nature/berries.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:boulder','NATURE','{"id":"nature:boulder","a":"BOULDER","label":"BOULDER","pic":"🖼️","image":"assets/images/categories/nature/boulder.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:bramble','NATURE','{"id":"nature:bramble","a":"BRAMBLE","label":"BRAMBLE","pic":"🖼️","image":"assets/images/categories/nature/bramble.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:branch','NATURE','{"id":"nature:branch","a":"BRANCH","label":"BRANCH","pic":"🖼️","image":"assets/images/categories/nature/branch.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:butterfly','NATURE','{"id":"nature:butterfly","a":"BUTTERFLY","label":"BUTTERFLY","pic":"🖼️","image":"assets/images/categories/nature/butterfly.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:canyon','NATURE','{"id":"nature:canyon","a":"CANYON","label":"CANYON","pic":"🖼️","image":"assets/images/categories/nature/canyon.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:caterpillar','NATURE','{"id":"nature:caterpillar","a":"CATERPILLAR","label":"CATERPILLAR","pic":"🖼️","image":"assets/images/categories/nature/caterpillar.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:cave','NATURE','{"id":"nature:cave","a":"CAVE","label":"CAVE","pic":"🖼️","image":"assets/images/categories/nature/cave.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:chestnut','NATURE','{"id":"nature:chestnut","a":"CHESTNUT","label":"CHESTNUT","pic":"🖼️","image":"assets/images/categories/nature/chestnut.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:cliff','NATURE','{"id":"nature:cliff","a":"CLIFF","label":"CLIFF","pic":"🖼️","image":"assets/images/categories/nature/cliff.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:cloud','NATURE','{"id":"nature:cloud","a":"CLOUD","label":"CLOUD","pic":"🖼️","image":"assets/images/categories/nature/cloud.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:conker','NATURE','{"id":"nature:conker","a":"CONKER","label":"CONKER","pic":"🖼️","image":"assets/images/categories/nature/conker.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:coral-reef','NATURE','{"id":"nature:coral-reef","a":"CORALREEF","label":"CORAL REEF","pic":"🖼️","image":"assets/images/categories/nature/coral-reef.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:creek','NATURE','{"id":"nature:creek","a":"CREEK","label":"CREEK","pic":"🖼️","image":"assets/images/categories/nature/creek.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:desert','NATURE','{"id":"nature:desert","a":"DESERT","label":"DESERT","pic":"🖼️","image":"assets/images/categories/nature/desert.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:dew','NATURE','{"id":"nature:dew","a":"DEW","label":"DEW","pic":"🖼️","image":"assets/images/categories/nature/dew.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:dragonfly','NATURE','{"id":"nature:dragonfly","a":"DRAGONFLY","label":"DRAGONFLY","pic":"🖼️","image":"assets/images/categories/nature/dragonfly.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:forest','NATURE','{"id":"nature:forest","a":"FOREST","label":"FOREST","pic":"🖼️","image":"assets/images/categories/nature/forest.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:geyser','NATURE','{"id":"nature:geyser","a":"GEYSER","label":"GEYSER","pic":"🖼️","image":"assets/images/categories/nature/geyser.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:glacier','NATURE','{"id":"nature:glacier","a":"GLACIER","label":"GLACIER","pic":"🖼️","image":"assets/images/categories/nature/glacier.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:grass','NATURE','{"id":"nature:grass","a":"GRASS","label":"GRASS","pic":"🖼️","image":"assets/images/categories/nature/grass.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:heather','NATURE','{"id":"nature:heather","a":"HEATHER","label":"HEATHER","pic":"🖼️","image":"assets/images/categories/nature/heather.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:hills','NATURE','{"id":"nature:hills","a":"HILLS","label":"HILLS","pic":"🖼️","image":"assets/images/categories/nature/hills.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:ice','NATURE','{"id":"nature:ice","a":"ICE","label":"ICE","pic":"🖼️","image":"assets/images/categories/nature/ice.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:iceberg','NATURE','{"id":"nature:iceberg","a":"ICEBERG","label":"ICEBERG","pic":"🖼️","image":"assets/images/categories/nature/iceberg.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:island','NATURE','{"id":"nature:island","a":"ISLAND","label":"ISLAND","pic":"🖼️","image":"assets/images/categories/nature/island.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:ivy','NATURE','{"id":"nature:ivy","a":"IVY","label":"IVY","pic":"🖼️","image":"assets/images/categories/nature/ivy.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:ladybird','NATURE','{"id":"nature:ladybird","a":"LADYBIRD","label":"LADYBIRD","pic":"🖼️","image":"assets/images/categories/nature/ladybird.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:lake','NATURE','{"id":"nature:lake","a":"LAKE","label":"LAKE","pic":"🖼️","image":"assets/images/categories/nature/lake.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:leaf','NATURE','{"id":"nature:leaf","a":"LEAF","label":"LEAF","pic":"🖼️","image":"assets/images/categories/nature/leaf.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:lichen','NATURE','{"id":"nature:lichen","a":"LICHEN","label":"LICHEN","pic":"🖼️","image":"assets/images/categories/nature/lichen.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:lightning','NATURE','{"id":"nature:lightning","a":"LIGHTNING","label":"LIGHTNING","pic":"🖼️","image":"assets/images/categories/nature/lightning.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:meadow','NATURE','{"id":"nature:meadow","a":"MEADOW","label":"MEADOW","pic":"🖼️","image":"assets/images/categories/nature/meadow.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:moon','NATURE','{"id":"nature:moon","a":"MOON","label":"MOON","pic":"🖼️","image":"assets/images/categories/nature/moon.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:moss','NATURE','{"id":"nature:moss","a":"MOSS","label":"MOSS","pic":"🖼️","image":"assets/images/categories/nature/moss.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:mountain','NATURE','{"id":"nature:mountain","a":"MOUNTAIN","label":"MOUNTAIN","pic":"🖼️","image":"assets/images/categories/nature/mountain.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:mud','NATURE','{"id":"nature:mud","a":"MUD","label":"MUD","pic":"🖼️","image":"assets/images/categories/nature/mud.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:mushroom','NATURE','{"id":"nature:mushroom","a":"MUSHROOM","label":"MUSHROOM","pic":"🖼️","image":"assets/images/categories/nature/mushroom.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:ocean','NATURE','{"id":"nature:ocean","a":"OCEAN","label":"OCEAN","pic":"🖼️","image":"assets/images/categories/nature/ocean.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:pebble','NATURE','{"id":"nature:pebble","a":"PEBBLE","label":"PEBBLE","pic":"🖼️","image":"assets/images/categories/nature/pebble.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:pine-cone','NATURE','{"id":"nature:pine-cone","a":"PINECONE","label":"PINE CONE","pic":"🖼️","image":"assets/images/categories/nature/pine-cone.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:puddle','NATURE','{"id":"nature:puddle","a":"PUDDLE","label":"PUDDLE","pic":"🖼️","image":"assets/images/categories/nature/puddle.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:rain','NATURE','{"id":"nature:rain","a":"RAIN","label":"RAIN","pic":"🖼️","image":"assets/images/categories/nature/rain.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:rainbow','NATURE','{"id":"nature:rainbow","a":"RAINBOW","label":"RAINBOW","pic":"🖼️","image":"assets/images/categories/nature/rainbow.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:reeds','NATURE','{"id":"nature:reeds","a":"REEDS","label":"REEDS","pic":"🖼️","image":"assets/images/categories/nature/reeds.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:river','NATURE','{"id":"nature:river","a":"RIVER","label":"RIVER","pic":"🖼️","image":"assets/images/categories/nature/river.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:rock','NATURE','{"id":"nature:rock","a":"ROCK","label":"ROCK","pic":"🖼️","image":"assets/images/categories/nature/rock.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:roots','NATURE','{"id":"nature:roots","a":"ROOTS","label":"ROOTS","pic":"🖼️","image":"assets/images/categories/nature/roots.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:sand-dune','NATURE','{"id":"nature:sand-dune","a":"SANDDUNE","label":"SAND DUNE","pic":"🖼️","image":"assets/images/categories/nature/sand-dune.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:sand','NATURE','{"id":"nature:sand","a":"SAND","label":"SAND","pic":"🖼️","image":"assets/images/categories/nature/sand.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:seed','NATURE','{"id":"nature:seed","a":"SEED","label":"SEED","pic":"🖼️","image":"assets/images/categories/nature/seed.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:snail','NATURE','{"id":"nature:snail","a":"SNAIL","label":"SNAIL","pic":"🖼️","image":"assets/images/categories/nature/snail.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:snow','NATURE','{"id":"nature:snow","a":"SNOW","label":"SNOW","pic":"🖼️","image":"assets/images/categories/nature/snow.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:snowflake','NATURE','{"id":"nature:snowflake","a":"SNOWFLAKE","label":"SNOWFLAKE","pic":"🖼️","image":"assets/images/categories/nature/snowflake.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:soil','NATURE','{"id":"nature:soil","a":"SOIL","label":"SOIL","pic":"🖼️","image":"assets/images/categories/nature/soil.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:spider-web','NATURE','{"id":"nature:spider-web","a":"SPIDERWEB","label":"SPIDER WEB","pic":"🖼️","image":"assets/images/categories/nature/spider-web.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:spider','NATURE','{"id":"nature:spider","a":"SPIDER","label":"SPIDER","pic":"🖼️","image":"assets/images/categories/nature/spider.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:stars','NATURE','{"id":"nature:stars","a":"STARS","label":"STARS","pic":"🖼️","image":"assets/images/categories/nature/stars.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:stone','NATURE','{"id":"nature:stone","a":"STONE","label":"STONE","pic":"🖼️","image":"assets/images/categories/nature/stone.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:storm','NATURE','{"id":"nature:storm","a":"STORM","label":"STORM","pic":"🖼️","image":"assets/images/categories/nature/storm.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:sunbeam','NATURE','{"id":"nature:sunbeam","a":"SUNBEAM","label":"SUNBEAM","pic":"🖼️","image":"assets/images/categories/nature/sunbeam.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:sunset','NATURE','{"id":"nature:sunset","a":"SUNSET","label":"SUNSET","pic":"🖼️","image":"assets/images/categories/nature/sunset.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:swamp','NATURE','{"id":"nature:swamp","a":"SWAMP","label":"SWAMP","pic":"🖼️","image":"assets/images/categories/nature/swamp.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:thunderstorm','NATURE','{"id":"nature:thunderstorm","a":"THUNDERSTORM","label":"THUNDERSTORM","pic":"🖼️","image":"assets/images/categories/nature/thunderstorm.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:tornado','NATURE','{"id":"nature:tornado","a":"TORNADO","label":"TORNADO","pic":"🖼️","image":"assets/images/categories/nature/tornado.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:tree','NATURE','{"id":"nature:tree","a":"TREE","label":"TREE","pic":"🖼️","image":"assets/images/categories/nature/tree.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:valley','NATURE','{"id":"nature:valley","a":"VALLEY","label":"VALLEY","pic":"🖼️","image":"assets/images/categories/nature/valley.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:vine','NATURE','{"id":"nature:vine","a":"VINE","label":"VINE","pic":"🖼️","image":"assets/images/categories/nature/vine.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:volcano','NATURE','{"id":"nature:volcano","a":"VOLCANO","label":"VOLCANO","pic":"🖼️","image":"assets/images/categories/nature/volcano.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:waterfall','NATURE','{"id":"nature:waterfall","a":"WATERFALL","label":"WATERFALL","pic":"🖼️","image":"assets/images/categories/nature/waterfall.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
insert into public.category_pictures(id,category_id,question,active) values ('nature:worm','NATURE','{"id":"nature:worm","a":"WORM","label":"WORM","pic":"🖼️","image":"assets/images/categories/nature/worm.webp","gt":7000,"gs":3800,"generated":true}'::jsonb,true)
on conflict(id) do update set question=excluded.question, active=true;
