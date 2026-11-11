insert into public.category_pictures(id,category_id,question,active)
select 'objects:' || slug, 'OBJECTS', jsonb_build_object(
  'id','objects:' || slug,'a',upper(slug),'label',upper(slug),
  'image','assets/images/categories/objects/' || slug || '.webp',
  'pic','🖼️','gs',3800,'gt',7000
), true
from unnest(array['key', 'whisk', 'padlock', 'toothbrush', 'kettle', 'pencil', 'fork', 'comb', 'stapler', 'toaster', 'torch', 'paperclip']) as items(slug)
on conflict (id) do nothing;
