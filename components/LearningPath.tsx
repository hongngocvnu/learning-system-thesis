import React from 'react'
import { MABAssessment } from '../services/mab'
import { WeakLO } from '../services/mab'

interface LearningPathProps {
  mabAssessment: MABAssessment
  weakestLoId: WeakLO | null
}

const LearningPath: React.FC<LearningPathProps> = ({ mabAssessment, weakestLoId }) => {
  if (!weakestLoId) return null

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold text-[#0f2a4e] mb-4">Learning Path Recommendation</h3>
      
      <div className="mb-6">
        <h4 className="text-lg font-medium text-[#0f2a4e] mb-2">Weakest Knowledge Component</h4>
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="font-medium text-red-800">{weakestLoId.lo_code}: {weakestLoId.title}</p>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-medium text-[#0f2a4e] mb-4">Recommended Learning Path</h4>
        <div className="space-y-4">
          {weakestLoId.learning_path.map((lo, index) => (
            <div key={lo.id} className="relative">
              {/* Connection line */}
              {index < weakestLoId.learning_path.length - 1 && (
                <div className="absolute left-4 top-12 w-0.5 h-8 bg-gray-300" />
              )}
              
              <div className="flex items-start space-x-4">
                {/* Node circle */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium
                  ${lo.id === weakestLoId.id ? 'bg-red-500' : 'bg-blue-500'}`}>
                  {index + 1}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-[#0f2a4e]">{lo.lo_code}: {lo.title}</p>
                    
                    <div className="mt-2 space-y-2">
                      {/* Mastery bar */}
                      <div>
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Mastery</span>
                          <span>{Math.round(lo.mastery * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${lo.mastery * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Confidence bar */}
                      <div>
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Confidence</span>
                          <span>{Math.round(lo.confidence * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${lo.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>This learning path is designed to help you master the identified weak knowledge component.</p>
        <p>Follow the sequence from top to bottom, focusing on understanding each concept before moving to the next.</p>
      </div>
    </div>
  )
}

export default LearningPath 