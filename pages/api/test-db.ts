import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Test connection by fetching a single row from courses
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .limit(1)

    if (error) {
      console.error('Database connection error:', error)
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: error 
      })
    }

    return res.status(200).json({ 
      message: 'Database connection successful',
      data 
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({ 
      error: 'Unexpected error occurred',
      details: error 
    })
  }
} 