import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

interface VirtualListProps<T> {
    /** Array of items to render */
    items: T[];
    /** Height of each item in pixels (must be consistent) */
    itemHeight: number;
    /** Height of the container in pixels */
    containerHeight: number;
    /** Number of items to render above/below the visible area */
    overscan?: number;
    /** Render function for each item */
    renderItem: (item: T, index: number) => React.ReactNode;
    /** Optional key extractor */
    keyExtractor?: (item: T, index: number) => string;
    /** Optional className for the container */
    className?: string;
    /** Optional empty state renderer */
    emptyState?: React.ReactNode;
}

/**
 * VirtualList - A lightweight virtual scrolling component
 * 
 * Only renders items that are visible in the viewport (plus a small buffer),
 * dramatically reducing DOM nodes for large lists.
 */
export function VirtualList<T>({
    items,
    itemHeight,
    containerHeight,
    overscan = 3,
    renderItem,
    keyExtractor,
    className = '',
    emptyState
}: VirtualListProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);

    // Handle scroll events
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // Calculate which items to render
    const { visibleItems, startIndex, totalHeight, offsetY } = useMemo(() => {
        const totalHeight = items.length * itemHeight;

        // Calculate visible range
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * overscan;
        const endIndex = Math.min(items.length, startIndex + visibleCount);

        // Extract visible items
        const visibleItems = items.slice(startIndex, endIndex);

        // Calculate offset for positioning
        const offsetY = startIndex * itemHeight;

        return { visibleItems, startIndex, totalHeight, offsetY };
    }, [items, itemHeight, containerHeight, scrollTop, overscan]);

    // Empty state
    if (items.length === 0 && emptyState) {
        return <div className={className}>{emptyState}</div>;
    }

    return (
        <div
            ref={containerRef}
            className={`overflow-y-auto ${className}`}
            style={{ height: containerHeight }}
            onScroll={handleScroll}
        >
            {/* Spacer to maintain scroll height */}
            <div style={{ height: totalHeight, position: 'relative' }}>
                {/* Positioned container for visible items */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        transform: `translateY(${offsetY}px)`
                    }}
                >
                    {visibleItems.map((item, index) => {
                        const actualIndex = startIndex + index;
                        const key = keyExtractor ? keyExtractor(item, actualIndex) : actualIndex.toString();

                        return (
                            <div key={key} style={{ height: itemHeight }}>
                                {renderItem(item, actualIndex)}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/**
 * Hook for detecting when an element enters the viewport
 * Useful for lazy-loading images in virtualized lists
 */
export function useIntersectionObserver(
    callback: (entry: IntersectionObserverEntry) => void,
    options?: IntersectionObserverInit
) {
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(callback);
        }, {
            threshold: 0.1,
            ...options
        });

        observer.observe(element);

        return () => observer.disconnect();
    }, [callback, options]);

    return elementRef;
}

export default VirtualList;
