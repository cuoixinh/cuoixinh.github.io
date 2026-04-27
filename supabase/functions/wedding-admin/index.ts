import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token') || req.headers.get('x-admin-token')
  const isAdmin = token === Deno.env.get('ADMIN_SECRET_TOKEN')
  const method = req.method

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // POST → Tạo bản ghi mới (public - KH tự tạo sau khi thanh toán)
  if (method === 'POST') {
    const body = await req.json()
    const { slug, id: clientId, contact } = body
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Missing slug' }), {
        status: 400, headers: corsHeaders
      })
    }

    // Check if slug already exists, auto-append suffix if duplicate
    let finalSlug = slug;
    let suffix = 1;
    while (true) {
      const { data: existing } = await supabase
        .from('weddings')
        .select('id')
        .eq('slug', finalSlug)
        .single()
      if (!existing) break;
      suffix++;
      finalSlug = `${slug}-${suffix}`;
    }

    const insertPayload = clientId
      ? { id: clientId, slug: finalSlug, is_active: true }
      : { slug: finalSlug, is_active: true }

    const { data, error } = await supabase
      .from('weddings')
      .insert(insertPayload)
      .select('id, slug')
      .single()

    if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

    return new Response(JSON.stringify({ id: data.id, slug: data.slug }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // PATCH → Cập nhật thiệp (khách dùng id, admin dùng id + token)
  if (method === 'PATCH') {
    const body = await req.json()
    const { id, deleted_images, ...fields } = body

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400, headers: corsHeaders
      })
    }

    // Kiểm tra id tồn tại và lấy data hiện tại
    const { data: existing, error: fetchError } = await supabase
      .from('weddings')
      .select('cover_image_url, groom_image_url, bride_image_url, groom_qr_url, bride_qr_url, gallery_images')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return new Response(JSON.stringify({ error: 'Wedding not found' }), {
        status: 404, headers: corsHeaders
      })
    }

    // Validate deleted_images: chỉ cho phép xóa ảnh thuộc về wedding này
    if (deleted_images && deleted_images.length > 0) {
      // Collect all valid filenames from this wedding
      const validFilenames = [
        existing.cover_image_url,
        existing.groom_image_url,
        existing.bride_image_url,
        existing.groom_qr_url,
        existing.bride_qr_url,
        ...(existing.gallery_images || [])
      ].filter(Boolean) // Remove null/undefined

      // Filter deleted_images to only include valid filenames
      const validDeletedImages = deleted_images.filter(filename => 
        validFilenames.includes(filename)
      )

      if (validDeletedImages.length > 0) {
        console.log('Deleting images from storage:', validDeletedImages)
        const { error: deleteError } = await supabase.storage
          .from('wedding-images')
          .remove(validDeletedImages)
        
        if (deleteError) {
          console.error('Error deleting images:', deleteError)
          // Continue anyway, don't fail the whole request
        }
      } else {
        console.log('No valid images to delete')
      }
    }

    // Khách không được đổi is_active, chỉ admin mới đổi được
    if (!isAdmin) {
      delete fields.is_active
    }

    // Check slug trùng nếu có đổi slug (loại trừ chính nó)
    if (fields.slug) {
      const { data: slugExisting } = await supabase
        .from('weddings')
        .select('id')
        .eq('slug', fields.slug)
        .neq('id', id)
        .single()

      if (slugExisting) {
        return new Response(JSON.stringify({ error: 'Tên slug đã được người khác sử dụng. Vui lòng chọn tên khác' }), {
          status: 409, headers: corsHeaders
        })
      }
    }

    const { error } = await supabase
      .from('weddings').update(fields).eq('id', id)

    if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // GET → Lấy thông tin thiệp theo slug hoặc id (public, không cần token)
  // hoặc list tất cả (admin only, có phân trang)
  if (method === 'GET') {
    const slug = url.searchParams.get('slug')
    const id = url.searchParams.get('id')
    const list = url.searchParams.get('list')
    
    // List all weddings with pagination (admin only)
    if (list === 'true') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: corsHeaders
        })
      }

      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '10')
      const search = url.searchParams.get('search') || ''
      const offset = (page - 1) * limit

      // Build query with search
      let query = supabase.from('weddings').select('*', { count: 'exact' })
      
      if (search) {
        query = query.or(`slug.ilike.%${search}%,groom_name.ilike.%${search}%,bride_name.ilike.%${search}%`)
      }

      // Get total count
      const { count } = await query

      // Get paginated data
      let dataQuery = supabase
        .from('weddings')
        .select('id, slug, groom_name, bride_name, is_active, created_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      if (search) {
        dataQuery = dataQuery.or(`slug.ilike.%${search}%,groom_name.ilike.%${search}%,bride_name.ilike.%${search}%`)
      }

      const { data, error } = await dataQuery

      if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

      return new Response(JSON.stringify({
        data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get single wedding by slug or id
    if (!slug && !id) {
      return new Response(JSON.stringify({ error: 'Missing slug or id' }), {
        status: 400, headers: corsHeaders
      })
    }

    let query = supabase.from('weddings').select('*')
    
    if (slug) {
      query = query.eq('slug', slug)
    } else if (id) {
      query = query.eq('id', id)
    }

    const { data, error } = await query.single()

    if (error) return new Response(JSON.stringify({ error }), { status: 404, headers: corsHeaders })

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // DELETE → Xóa thiệp (chỉ admin)
  if (method === 'DELETE') {
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: corsHeaders
      })
    }

    const id = url.searchParams.get('id')
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400, headers: corsHeaders
      })
    }

    // Get wedding data to delete images
    const { data: wedding, error: fetchError } = await supabase
      .from('weddings')
      .select('cover_image_url, groom_image_url, bride_image_url, groom_qr_url, bride_qr_url, gallery_images')
      .eq('id', id)
      .single()

    if (fetchError || !wedding) {
      return new Response(JSON.stringify({ error: 'Wedding not found' }), {
        status: 404, headers: corsHeaders
      })
    }

    // Collect all image filenames
    const imageFiles = [
      wedding.cover_image_url,
      wedding.groom_image_url,
      wedding.bride_image_url,
      wedding.groom_qr_url,
      wedding.bride_qr_url,
      ...(wedding.gallery_images || [])
    ].filter(Boolean)

    // Delete images from storage
    if (imageFiles.length > 0) {
      await supabase.storage.from('wedding-images').remove(imageFiles)
    }

    // Delete wedding record
    const { error } = await supabase.from('weddings').delete().eq('id', id)

    if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: corsHeaders
  })
})
