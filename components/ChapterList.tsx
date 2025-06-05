import React from 'react';
import { useRouter } from 'next/router';

interface Chapter {
    id: number;
    name: string;
    order_num: number;
    course_id: number;
}

interface ChapterListProps {
    chapters: Chapter[];
    courseId: number;
}

export default function ChapterList({ chapters, courseId }: ChapterListProps) {
    const router = useRouter();

    const handleChapterSelect = (chapterId: number) => {
        router.push(`/student-test/${courseId}?chapterId=${chapterId}`);
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Chọn Chapter để làm bài kiểm tra</h2>
            <div className="grid gap-4">
                {chapters.map((chapter) => (
                    <button
                        key={chapter.id}
                        onClick={() => handleChapterSelect(chapter.id)}
                        className="flex items-center justify-between p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full">
                                {chapter.order_num}
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-medium text-gray-900">{chapter.name}</h3>
                            </div>
                        </div>
                        <div className="text-blue-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
} 