import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SORT_ALIASES = {
  'price-asc': 'price_asc',
  'price-desc': 'price_desc',
  name: 'name_asc',
};

export const searchQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(200, 'Search query must be 200 characters or fewer')
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined)),
    category: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined)),
    store: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined)),
    minPrice: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => (val === undefined || val === '' ? undefined : Number(val)))
      .refine((val) => val === undefined || (Number.isFinite(val) && val >= 0), {
        message: 'minPrice must be a non-negative number',
      }),
    maxPrice: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => (val === undefined || val === '' ? undefined : Number(val)))
      .refine((val) => val === undefined || (Number.isFinite(val) && val >= 0), {
        message: 'maxPrice must be a non-negative number',
      }),
    inStock: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    sort: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined;
        return SORT_ALIASES[val] || val;
      })
      .refine(
        (val) =>
          val === undefined ||
          ['relevance', 'price_asc', 'price_desc', 'name_asc', 'name_desc', 'newest'].includes(val),
        {
          message:
            'sort must be one of: relevance, price_asc, price_desc, name_asc, name_desc, newest',
        }
      ),
    page: z
      .union([z.string(), z.number()])
      .optional()
      .default(1)
      .transform((val) => Number(val))
      .refine((val) => Number.isInteger(val) && val >= 1, {
        message: 'page must be an integer >= 1',
      }),
    pageSize: z
      .union([z.string(), z.number()])
      .optional()
      .default(20)
      .transform((val) => Number(val))
      .refine((val) => Number.isInteger(val) && val >= 1 && val <= 100, {
        message: 'pageSize must be an integer between 1 and 100',
      }),
  })
  .refine(
    (data) =>
      data.minPrice === undefined ||
      data.maxPrice === undefined ||
      data.minPrice <= data.maxPrice,
    {
      message: 'minPrice cannot be greater than maxPrice',
      path: ['minPrice'],
    }
  );

export function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
