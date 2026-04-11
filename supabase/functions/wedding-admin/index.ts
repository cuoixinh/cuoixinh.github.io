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

  // POST → Tạo bản ghi mới (chỉ admin)
  if (method === 'POST') {
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: corsHeaders
      })
    }

    const body = await req.json()
    const { contact } = body
    if (!contact) {
      return new Response(JSON.stringify({ error: 'Missing contact' }), {
        status: 400, headers: corsHeaders
      })
    }

    const { data, error } = await supabase
      .from('weddings')
      .insert({ contact, is_active: true })
      .select('id')
      .single()

    if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

    return new Response(JSON.stringify({ id: data.id }), {
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

    // Khách không được đổi is_active và contact
    if (!isAdmin) {
      delete fields.is_active
      delete fields.contact
    }

    const { error } = await supabase
      .from('weddings').update(fields).eq('id', id)

    if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // GET → Lấy thông tin thiệp theo id (public, không cần token)
  if (method === 'GET') {
    const id = url.searchParams.get('id')
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400, headers: corsHeaders
      })
    }

    const { data, error } = await supabase
      .from('weddings').select('*').eq('id', id).single()

    if (error) return new Response(JSON.stringify({ error }), { status: 404, headers: corsHeaders })

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: corsHeaders
  })
})
