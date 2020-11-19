export const elm = (id: string) => {
    const el = document.getElementById(id);
    if (!el) {
        console.log('no element with id: ' + id)
        throw 'error'
    }
    
    return el;
};

// const sleeper = (ms: number) => <T>(x: T): Promise<T> => 
//     new Promise(resolve => setTimeout(() => resolve(x), ms));