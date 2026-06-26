
let ACCESS_TOKEN = '';

async function generateToken() {
  const response = await fetch(
    `https://${process.env.SHOP}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
      }),
    }
  );

  const data = await response.json();

  return data.access_token;
}

const getApiUrl = () => `https://${process.env.SHOP}/admin/api/2024-04/graphql.json`;

const sleep = ms =>
  new Promise(r => setTimeout(r, ms));

const collectionCache = {};

async function graphql(query, variables = {}) {

  const response = await fetch(getApiUrl(), {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token':
        ACCESS_TOKEN
    },

    body: JSON.stringify({
      query,
      variables
    })
  });

  const json = await response.json();

  if (json.errors) {
    console.log(
      JSON.stringify(json.errors, null, 2)
    );
  }

  return json;
}

function parseJson(value) {

  try {

    if (!value) return [];

    value = value
      .trim()
      .replace(/^'|'$/g, '')
      .replace(
        /"size"\s*:\s*([^",}\]]+)/g,
        '"size":"$1"'
      )
      .replace(/"(\w+)""/g, '"$1"');

    return JSON.parse(value);

  } catch {

    return [];
  }
}

const FormData = require('form-data');

async function uploadVideoToShopify(videoUrl, filename) {

  const videoRes = await fetch(videoUrl);

  if (!videoRes.ok) {
    throw new Error(
      `Failed to download video: ${videoRes.status}`
    );
  }

  const videoBuffer = Buffer.from(
    await videoRes.arrayBuffer()
  );

  const fileSize = videoBuffer.length.toString();

  const stagedRes = await graphql(`
    mutation stagedUploadsCreate(
      $input: [StagedUploadInput!]!
    ) {
      stagedUploadsCreate(input: $input) {

        stagedTargets {
          url
          resourceUrl

          parameters {
            name
            value
          }
        }

        userErrors {
          field
          message
        }
      }
    }
  `, {
    input: [{
      filename,
      mimeType: 'video/mp4',
      httpMethod: 'POST',
      resource: 'VIDEO',
      fileSize
    }]
  });

  const uploadErrors =
    stagedRes?.data?.stagedUploadsCreate?.userErrors;

  if (uploadErrors?.length) {
    throw new Error(uploadErrors[0].message);
  }

  const target =
    stagedRes.data.stagedUploadsCreate
      .stagedTargets[0];

  const formData = new FormData();

  target.parameters.forEach(param => {
    formData.append(param.name, param.value);
  });

  formData.append(
    'file',
    videoBuffer,
    {
      filename,
      contentType: 'video/mp4',
      knownLength: videoBuffer.length
    }
  );

  const uploadRes = await fetch(target.url, {
    method: 'POST',
    headers: formData.getHeaders(),
    body: formData
  });

  const uploadText = await uploadRes.text();

  if (
    uploadRes.status !== 200 &&
    uploadRes.status !== 201 &&
    uploadRes.status !== 204
  ) {
    throw new Error(
      `Video upload failed: ${uploadRes.status}`
    );
  }

  return target.resourceUrl;
}

function productMetafields(item) {

  const textFields = [
    { key: 'category', value: item.category || '' },
    { key: 'metal_type', value: item.metaltype || '' },
    { key: 'misc', value: item.misc || '-' },
    { key: 'gender', value: item.gender || '-' },
    { key: 'product_dimensions',value: item.height_width_length || '-'},
    { key: 'occassion', value: item.occassion || '' },
    { key: 'style', value: item.style || '' },
    { key: 'sub_category', value: item.subcategory || '' }
  ];

  const decimalFields = [
    { key: 'gross_weight', value: item.grosswt || 0 },
    { key: 'sale_price', value: item.saleprice || 0 },
    { key: 'color_stone_amount', value: item.colorstoneamount || 0 },
    { key: 'diamond_amount', value: item.diamondamount || 0 },
    { key: 'discounted_amount', value: item.discountedamount || 0 },
    { key: 'discount_percentage', value: item.discountpercentage || 0 },
    { key: 'gold_amount', value: item.goldamount || 0 },
    { key: 'making_charge', value: item.makingcharge || 0 },
    { key: 'metal_weight', value: item.metalwt || 0 },
    { key: 'misc_amount', value: item.miscamount || 0 },
    { key: 'mrp', value: item.mrp || 0 },
    { key: 'other_charge', value: item.othercharge || 0 },
    { key: 'tax_amount', value: item.taxamount || 0 }
  ];

  const jsonFields = [
    { key: 'color_stone', value: parseJson(item.colorstone)},
    { key: 'diamond_details',value: parseJson(item.diamond)},
    { key: 'tax_data',value: parseJson(item.taxdata)},
    { key: 'center_stone', value: parseJson(item.centerstone)}
  ];

  return [

    ...textFields.map(f => ({ namespace: 'custom', key: f.key, type: 'single_line_text_field',
     value: String(f.value) })),

    ...decimalFields.map(f => ({ namespace: 'custom', key: f.key, type: 'number_decimal',
     value: String(f.value) })),

    ...jsonFields.map(f => ({ namespace: 'custom', key: f.key, type: 'json',
     value: JSON.stringify(f.value) })),

  ];
}

function variantMetafields(item) {

  const textFields = [
   { key: 'product_type', value: item.producttype || '' },
   { key: 'misc', value: item.misc || '' }
  ];

  const decimalFields = [
    { key: 'gross_weight', value: item.grosswt || 0 },
    { key: 'sale_price', value: item.saleprice || 0 },
    { key: 'diamond_amount', value: item.diamondamount || 0 },
    { key: 'color_stone_amount', value: item.colorstoneamount || 0 },
    { key: 'gold_amount', value: item.goldamount || 0 },
    { key: 'making_charge', value: item.makingcharge || 0 },
    { key: 'metal_weight', value: item.metalwt || 0 },
    { key: 'misc_amount', value: item.miscamount || 0 },
    { key: 'mrp', value: item.mrp || 0 },
    { key: 'tax_amount', value: item.taxamount || 0 }
  ];

  const jsonFields = [
    { key: 'diamond_details',value: parseJson(item.diamond)},
    { key: 'color_stone', value: parseJson(item.colorstone)},
    { key: 'center_stone', value: parseJson(item.centerstone)}
  ];

  return [
    ...textFields.map(f => ({ namespace: 'custom', key: f.key, type: 'single_line_text_field',
     value: String(f.value) })),

    ...decimalFields.map(f => ({ namespace: 'custom', key: f.key, type: 'number_decimal',
     value: String(f.value) })),

    ...jsonFields.map(f => ({ namespace: 'custom', key: f.key, type: 'json',
     value: JSON.stringify(f.value) })),
  ];
}

// PRODUCT OPTIONS

function buildOptions(items) {

  if (!Array.isArray(items)) {
    items = [items];
  }

  const options = [];

  const metalColors = [...new Set(items.map(item => item.metalcolor).filter(Boolean))];

  const metalQualities = [...new Set(items.map(item => item.metalquality).filter(Boolean))];

  const jewellerySizes = [...new Set(items.map(item => item.jewllerysize).filter(Boolean))];

  if (metalColors?.[0]) {
    options.push({ name: 'Metal Color', values: metalColors.map(value => ({ name: String(value) })) });
  }

  if (metalQualities?.[0]) {
    options.push({ name: 'Metal Quality', values: metalQualities.map(value => ({ name: String(value) })) });
  }


  if (jewellerySizes?.[0]) {
   options.push({ name: 'Jewellery Size', values: jewellerySizes.map(value => ({ name: String(value) })) });
  }

  return options;
}

// VARIANT OPTION VALUES

function buildVariantOptionValues(item) {

  const optionValues = [];

  if (item.metalcolor) {
    optionValues.push({ optionName: 'Metal Color', name: String(item.metalcolor) });
  }

  if (item.metalquality) {

    optionValues.push({ optionName: 'Metal Quality', name: String(item.metalquality) });
  }

  if (item.jewllerysize) {
    optionValues.push({ optionName: 'Jewellery Size', name: String(item.jewllerysize)});
  }

  return optionValues;
}

const GET_PRODUCT = `
query ($handle: String!) {
  productByHandle(handle: $handle) {
    id
  }
}
`;

const SET_METAFIELDS = `
mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      key
    }

    userErrors {
      field
      message
    }
  }
}
`;

const FIND_COLLECTION = `
query ($query: String!) {
  collections(first: 1, query: $query) {
    edges {
      node {
        id
      }
    }
  }
}
`;

const CREATE_COLLECTION = `
mutation ($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection {
      id
    }
  }
}
`;

const ADD_TO_COLLECTION = `
mutation ($id: ID!, $productIds: [ID!]!) {
  collectionAddProducts(
    id: $id,
    productIds: $productIds
  ) {
    collection {
      id
    }
  }
}
`;

const CREATE_PRODUCT = `
mutation (
  $input: ProductInput!,
  $media: [CreateMediaInput!]
) {
  productCreate(
    input: $input,
    media: $media
  ) {
    product {
      id
    }

    userErrors {
      field
      message
    }
  }
}
`;

const UPDATE_PRODUCT = `
mutation ($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
    }
  }
}
`;

const GET_VARIANT = `
query ($id: ID!) {
  product(id: $id) {
    variants(first: 1) {
      edges {
        node {
          id
        }
      }
    }
  }
}
`;

const UPDATE_VARIANT = `
mutation (
  $productId: ID!,
  $variants: [ProductVariantsBulkInput!]!
) {
  productVariantsBulkUpdate(
    productId: $productId,
    variants: $variants
  ) {
    productVariants {
      id
    }

    userErrors {
      field
      message
    }
  }
}
`;

const CREATE_VARIANTS_BULK = `
mutation (
  $productId: ID!,
  $variants: [ProductVariantsBulkInput!]!
) {
  productVariantsBulkCreate(
    productId: $productId,
    variants: $variants
  ) {
    productVariants {
      id
    }

    userErrors {
      field
      message
    }
  }
}
`;

const CREATE_OPTIONS = `
mutation (
  $productId: ID!,
  $options: [OptionCreateInput!]!
) {
  productOptionsCreate(
    productId: $productId,
    options: $options
  ) {
    product {
      id
    }

    userErrors {
      field
      message
    }
  }
}
`;

async function getCollection(name) {

  if (!name) return null;

  if (collectionCache[name]) return collectionCache[name];

  const result = await graphql(FIND_COLLECTION, { query: `title:${name}` });

  let id = result?.data?.collections?.edges?.[0]?.node?.id;

  if (!id) {

    const created = await graphql(CREATE_COLLECTION, {
      input: { title: name }
    });

    id = created?.data?.collectionCreate?.collection?.id;
  }

  collectionCache[name] = id;

  return id;
}

async function importProduct(items) {

  if (!Array.isArray(items)) items = [items];

  const first = items[0];

  const handle = (first.designno || '').toLowerCase().replace(/[_ ]/g, '-');

  const title = first.titleline || first.designno || 'Untitled Product';

  const tags = [
    first.category,
    first.subcategory,
    first.style,
    first.gender,
    first.collection,
    first.brand,
    'Api_Import'
  ].filter(Boolean).join(', ');

  const hasVariants =
    items.length > 1 &&
    items.some(i =>
      i.metalcolor !== first.metalcolor ||
      i.metalquality !== first.metalquality ||
      i.jewllerysize !== first.jewllerysize
    );

  const productInput = {
    title,
    handle,
    vendor: first.brand || '',
    productType: first.producttype || '',
    tags,
    status: 'DRAFT',
    published: true,
    descriptionHtml: first.description || '',
    metafields: productMetafields(first)
  };

  const existing = await graphql(GET_PRODUCT, { handle });

  const existingProduct = existing?.data?.productByHandle;

  let productId;
  
  // UPDATE PRODUCT
  
 if (existingProduct) {

  const updated = await graphql(UPDATE_PRODUCT, {
    input: {
      id: existingProduct.id,
      ...productInput
    }
  });

  productId = updated?.data?.productUpdate?.product?.id;

  // UPDATE ALL VARIANTS

  if (hasVariants) {

    const GET_ALL_VARIANTS = `
    query ($id: ID!) {
      product(id: $id) {
        variants(first: 100) {
          edges {
            node {
              id
              sku
            }
          }
        }
      }
    }
    `;

    const variantResult = await graphql(
      GET_ALL_VARIANTS,
      { id: productId }
    );

    const existingVariants =
      variantResult?.data?.product?.variants?.edges || [];

    for (const item of items) {

      const matchedVariant =
        existingVariants.find(
          v => v.node.sku === item.articleno
        );

      const optionValues = [];

      if (item.metalcolor) {
        optionValues.push({
          optionName: 'Metal Color',
          name: item.metalcolor
        });
      }

      if (item.metalquality) {
        optionValues.push({
          optionName: 'Metal Quality',
          name: item.metalquality
        });
      }

      if (item.jewllerysize) {
        optionValues.push({
          optionName: 'Jewellery Size',
          name: item.jewllerysize
        });
      }

      // UPDATE EXISTING VARIANT

      if (matchedVariant) {

        await graphql(UPDATE_VARIANT, {
          productId,

          variants: [{
            id: matchedVariant.node.id,

            price: String(item.saleprice || item.price || 0),

            compareAtPrice:String(item.price || 0),

            metafields:
              variantMetafields(item),

            inventoryItem: {
              tracked: false,
              sku: item.articleno || ''
            },

            optionValues

          }]
        });

      } else {

        // CREATE NEW VARIANT

        await graphql(CREATE_VARIANTS_BULK, {
          productId,

          variants: [{
            price: String(
              item.saleprice ||
              item.price ||
              0
            ),

           compareAtPrice:String(item.price || 0),

            metafields:
              variantMetafields(item),

            inventoryItem: {
              tracked: false,
              sku: item.articleno || ''
            },

            optionValues
          }]
        });
      }
    }
   }
  }else {
    
    // CREATE PRODUCT
    
    const media = [];

    if (first.imagesrc) {
      media.push({
        originalSource: first.imagesrc,
        alt: title,
        mediaContentType: 'IMAGE'
      });
    }

   if (first.videosrc) {

      const videoUrl = first.videosrc;

      const isExternalPlatform =
        videoUrl.includes('youtube.com') ||
        videoUrl.includes('youtu.be') ||
        videoUrl.includes('vimeo.com');

      if (isExternalPlatform) {

        media.push({
          originalSource: videoUrl,
          alt: title,
          mediaContentType: 'EXTERNAL_VIDEO'
        });

      } else {

        try {

          const resourceUrl =
            await uploadVideoToShopify(
              videoUrl,
              `${handle}.mp4`
            );

          media.push({
            originalSource: resourceUrl,
            alt: title,
            mediaContentType: 'VIDEO'
          });

        } catch (err) {

          console.warn(
            `Skipping video for "${title}":`,
            err.message
          );
        }
      }
    }

    const created = await graphql(CREATE_PRODUCT, {
      input: productInput,
      media
    });

    productId = created?.data?.productCreate?.product?.id;
  }

  if (!productId) {
    throw new Error('Product not created');
  }
  
  // SIMPLE PRODUCT
  
  if (!hasVariants) {

    const varResult = await graphql(GET_VARIANT, { id: productId });

    const variantId = varResult?.data?.product?.variants?.edges?.[0]?.node?.id;

    if (variantId) {

      await graphql(UPDATE_VARIANT, {
        productId,
        variants: [{
          id: variantId,

          price: String(first.saleprice || first.price || 0),

          compareAtPrice: String(first.price || 0),

          inventoryItem: {
            tracked: false,
            sku: first.articleno || ''
          }
        }]
      });
    }

  } else {
    
    // VARIANT PRODUCT    

    const options = buildOptions(items);

    if (options.length > 0) {

      await graphql(CREATE_OPTIONS, {
        productId,
        options
      });

      await sleep(2000);
    }

    // UPDATE AUTO CREATED FIRST VARIANT

    const varResult = await graphql(GET_VARIANT, { id: productId });

    const firstVariantId = varResult?.data?.product?.variants?.edges?.[0]?.node?.id;

    if (firstVariantId) {

      const firstItem = items[0];

      const optionValues = [];

      if (firstItem.metalcolor) {
        optionValues.push({
          optionName: 'Metal Color',
          name: firstItem.metalcolor
        });
      }

      if (firstItem.metalquality) {
        optionValues.push({
          optionName: 'Metal Quality',
          name: firstItem.metalquality
        });
      }

      if (firstItem.jewllerysize) {
        optionValues.push({
          optionName: 'Jewellery Size',
          name: firstItem.jewllerysize
        });
      }

      await graphql(UPDATE_VARIANT, {
        productId,

        variants: [{
          id: firstVariantId,

          price: String(firstItem.saleprice || firstItem.price || 0),

          compareAtPrice: String(firstItem.price || 0),

          metafields: variantMetafields(firstItem),

          inventoryItem: {
            tracked: false,
            sku: firstItem.articleno || ''
          },

          optionValues,

          ...(firstItem.imagesrc && {
            mediaSrc: firstItem.imagesrc
          })
        }]
      });
    }

    // CREATE REMAINING VARIANTS

    const remainingItems = items.slice(1);

    const VARIANT_BATCH = 1;

    for (let i = 0; i < remainingItems.length; i += VARIANT_BATCH) {

      const batch = remainingItems.slice(i, i + VARIANT_BATCH);

      await Promise.all(
        batch.map(async item => {

          const optionValues = [];

          if (item.metalcolor) {
            optionValues.push({
              optionName: 'Metal Color',
              name: item.metalcolor
            });
          }

          if (item.metalquality) {
            optionValues.push({
              optionName: 'Metal Quality',
              name: item.metalquality
            });
          }

          if (item.jewllerysize) {
            optionValues.push({
              optionName: 'Jewellery Size',
              name: item.jewllerysize
            });
          }

          const variantInput = {

            price: String(item.saleprice || item.price || 0),

            compareAtPrice:String(item.price || 0),

            metafields: variantMetafields(item),

            inventoryItem: {
              tracked: false,
              sku: item.articleno || ''
            },

            ...(optionValues.length > 0 && {
              optionValues
            }),

            ...(item.imagesrc && {
              mediaSrc: item.imagesrc
            })
          };

          const created = await graphql(CREATE_VARIANTS_BULK, {
            productId,
            variants: [variantInput]
          });

          const errors =
            created?.data?.productVariantsBulkCreate?.userErrors;
        })
      );

      await sleep(500);
    }
  }

  // COLLECTION

  const collectionId = await getCollection(first.collection);

  if (collectionId) {

    await graphql(ADD_TO_COLLECTION, {
      id: collectionId,
      productIds: [productId]
    });
  }

  return productId;
}

async function main(targetDesignNo) {
  const startTime = Date.now();
  if (!targetDesignNo) {
    console.error('Target design number is required.');
    return;
  }

  const targetDesigns = targetDesignNo.split(',').map(d => d.trim());
  console.log(`[SCRIPT] Looking for Design Numbers:`, targetDesigns);

  console.log(`[SCRIPT] ⏳ Downloading data from External API... (This may take 15-30 seconds depending on data size)`);
  const res = await fetch(process.env.EXTERNAL_API);
  
  if (!res.ok) {
    throw new Error(`External API returned status: ${res.status}`);
  }

  console.log(`[SCRIPT] ⏳ Parsing the downloaded JSON data...`);
  const json = await res.json();
  console.log(`[SCRIPT] ✅ Total products loaded from API: ${json.data.length}`);

  const all = json.data || [];

  console.log(`[SCRIPT] ⏳ Grouping ${all.length} items by designno...`);
  const grouped = {};

  for (const item of all) {
    const key = item.designno || item.articleno;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  const groupedProducts = Object.values(grouped);
  console.log(`[SCRIPT] ✅ Grouped into ${groupedProducts.length} unique designs.`);

  const requestedDesignNos = targetDesigns;

  const availableDesignNos = new Set(
    groupedProducts.map(items => items[0]?.designno)
  );

  const notFoundDesignNos = requestedDesignNos.filter(
    design => !availableDesignNos.has(design)
  );

  notFoundDesignNos.forEach(design => {
    console.log(`❌ Design Number ${design} not found in the external API data.`);
  });

  const products = groupedProducts.filter(
    items => requestedDesignNos.includes(items[0]?.designno)
  );

  console.log(`[SCRIPT] 🔍 Found ${products.length} design(s) matching your request.`);

  // const products = groupedProducts.slice(400, 500);
  // const products = groupedProducts;

  //console.log(`📦 Total Rows: ${all.length}`);

  //console.log(`🧩 Total Products: ${products.length}`);

  let importedCount = 0;

  let failedCount = 0;

  const PRODUCT_BATCH = 5;

  for (let i = 0; i < products.length; i += PRODUCT_BATCH) {

    const batch = products.slice(i, i + PRODUCT_BATCH);

    await Promise.all(
      batch.map(async items => {

        try {

          //console.log(`📦 ${items[0].designno}`);

          await importProduct(items);

          importedCount++;

          console.log(`✅ Product ${items[0].designno} imported successfully`);

        } catch (err) {

          failedCount++;

          console.log(`❌ Product ${items[0].designno} failed to import`);

          console.log(err.message);
        }
      })
    );

    await sleep(300);
  }


  //console.log(`✅ Imported: ${importedCount}`);

  //console.log(`❌ Failed: ${failedCount}`);

  if (importedCount > 0) {
    console.log(`\nTotal ${importedCount} products imported successfully`);
  }


  const endTime = Date.now();
  const totalSeconds = Math.floor((endTime - startTime) / 1000);

  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    console.log(`⏱ Total Execution Time: ${minutes} min ${seconds} sec`);
  } else {
    console.log(`⏱ Total Execution Time: ${totalSeconds} sec`);
  }

}

module.exports = async function handler(req, res) {
  // Set headers for Server-Sent Events (Live Streaming)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const originalLog = console.log;
  const originalError = console.error;

  // Override console.log to stream to the browser
  console.log = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    originalLog(msg);
    res.write(`data: ${msg.replace(/\n/g, '\\n')}\n\n`);
  };

  // Override console.error to stream to the browser
  console.error = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    originalError(msg);
    res.write(`data: ❌ ERROR: ${msg.replace(/\n/g, '\\n')}\n\n`);
  };

  try {
    const designNo = req.query.designno || req.body?.designnos || req.body?.designno;
    
    console.log(`\n==============================================`);
    console.log(`[API] 🚀 Received Import Request for: ${designNo}`);
    console.log(`==============================================`);
    
    if (!designNo) {
      console.error("Design number required.");
      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    }

    console.log(`[API] 🔐 Checking Shopify Authentication...`);
    if (!ACCESS_TOKEN) {
      ACCESS_TOKEN = await generateToken();
      console.log(`[API] 🔑 Generated new Shopify Access Token.`);
    } else {
      console.log(`[API] 🔑 Using existing Shopify Access Token.`);
    }

    console.log(`[API] ⚙️ Starting main import script...`);
    await main(designNo);
    
    console.log(`[API] ✅ Successfully finished import request for ${designNo}`);
  } catch (error) {
    console.error(`[API] ❌ FATAL ERROR: ${error.message}`);
  } finally {
    res.write(`data: [DONE]\n\n`);
    res.end();
    // Restore original console
    console.log = originalLog;
    console.error = originalError;
  }
};